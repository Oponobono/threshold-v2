import { fetchWithFallback, parseJsonSafely } from './client';
import { syncService } from '../database';

export interface GradingPeriod {
  id: string;
  user_id: string;
  name: string;
  period_type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_at: string;
}

export interface ThresholdOverride {
  id: string;
  user_id: string;
  subject_id: string;
  subject_name?: string;
  subject_color?: string;
  threshold: number;
}

export interface LmsAccount {
  id: string;
  user_id: string;
  platform: string;
  instance_url: string;
  username: string;
  created_at: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  secret?: string;
}

async function _repo() {
  const [g, l, t] = await Promise.all([
    import('../database/repositories/GradingPeriodRepository'),
    import('../database/repositories/LmsAccountRepository'),
    import('../database/repositories/ThresholdOverrideRepository'),
  ]);
  return { gradingPeriodRepo: g.gradingPeriodRepository, lmsAccountRepo: l.lmsAccountRepository, thresholdOverrideRepo: t.thresholdOverrideRepository };
}

function _cache() {
  const mmkv = require('react-native-mmkv').createMMKV();
  return { mmkv, set: (key: string, data: any) => mmkv.set(key, JSON.stringify(data)), get: (key: string) => { const v = mmkv.getString(key); return v ? JSON.parse(v) : null; } };
}

// ── Grading Periods ──────────────────────────────────────────

export const getGradingPeriods = async (): Promise<GradingPeriod[]> => {
  const repo = (await _repo()).gradingPeriodRepo;
  const cache = _cache();
  const local = await repo.getAll();
  if (local.length > 0) {
    _refreshGradingPeriods(repo, cache);
    return local;
  }
  try {
    const response = await fetchWithFallback('/grading-periods');
    if (!response.ok) throw new Error('Error al obtener períodos');
    const data = await parseJsonSafely(response);
    const periods: GradingPeriod[] = data?.periods || [];
    for (const p of periods) await repo.upsert(p);
    cache.set('cache:settings:grading_periods', periods);
    return periods;
  } catch (error) {
    const cached = cache.get('cache:settings:grading_periods');
    if (cached) return cached as GradingPeriod[];
    throw error;
  }
};

async function _refreshGradingPeriods(repo: any, cache: { set: (k: string, d: any) => void }) {
  try {
    const response = await fetchWithFallback('/grading-periods');
    if (!response.ok) return;
    const data = await parseJsonSafely(response);
    const periods: GradingPeriod[] = data?.periods || [];
    for (const p of periods) await repo.upsert(p);
    cache.set('cache:settings:grading_periods', periods);
  } catch { /* background refresh — best effort */ }
}

export const createGradingPeriod = async (name: string, period_type: string = 'custom', start_date?: string, end_date?: string): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();

  try {
    const response = await fetchWithFallback('/grading-periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, period_type, start_date: start_date || null, end_date: end_date || null }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al crear período'); }
    const result = await parseJsonSafely(response);
    const repo = (await _repo()).gradingPeriodRepo;
    await repo.upsert(result);
    _cache().set('cache:settings:grading_periods', await repo.getAll());
    return result;
  } catch {
    await syncService.enqueueCreate('grading-period', id, { name, period_type, start_date, end_date });
    const repo = (await _repo()).gradingPeriodRepo;
    await repo.upsert({ id, name, period_type, start_date, end_date } as any);
    _cache().set('cache:settings:grading_periods', await repo.getAll());
    return { id, name, period_type, _isPending: true };
  }
};

export const deleteGradingPeriod = async (id: string): Promise<void> => {
  try {
    const response = await fetchWithFallback(`/grading-periods/${id}`, { method: 'DELETE' });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al eliminar período'); }
    const repo = (await _repo()).gradingPeriodRepo;
    await repo.delete(id);
    _cache().set('cache:settings:grading_periods', await repo.getAll());
  } catch {
    await syncService.enqueueDelete('grading-period', id);
    const repo = (await _repo()).gradingPeriodRepo;
    await repo.delete(id);
    _cache().set('cache:settings:grading_periods', await repo.getAll());
  }
};

// ── Threshold Overrides ──────────────────────────────────────
// SQLite keeps synchronized backend data (via initial/delta sync).
// MMKV is the offline cache for edits not yet pushed.
// The GET function reads MMKV first (hot path) then refreshes from API.

export const getThresholdOverrides = async (): Promise<ThresholdOverride[]> => {
  const cache = _cache();
  const cached = cache.get('cache:settings:threshold_overrides');
  if (cached) {
    _refreshThresholdOverrides();
    return cached as ThresholdOverride[];
  }
  return _fetchThresholdOverrides();
};

async function _fetchThresholdOverrides(): Promise<ThresholdOverride[]> {
  const repo = (await _repo()).thresholdOverrideRepo;
  const cache = _cache();
  try {
    const response = await fetchWithFallback('/threshold-overrides');
    if (!response.ok) throw new Error('Error al obtener excepciones');
    const data = await parseJsonSafely(response);
    const overrides: ThresholdOverride[] = data?.overrides || [];
    await repo.replaceAll(overrides);
    cache.set('cache:settings:threshold_overrides', overrides);
    return overrides;
  } catch (error) {
    const local = await repo.getAll();
    if (local.length > 0) return local;
    const cached = cache.get('cache:settings:threshold_overrides');
    if (cached) return cached as ThresholdOverride[];
    throw error;
  }
}

async function _refreshThresholdOverrides(): Promise<void> {
  try {
    const response = await fetchWithFallback('/threshold-overrides');
    if (!response.ok) return;
    const data = await parseJsonSafely(response);
    const overrides: ThresholdOverride[] = data?.overrides || [];
    const repo = (await _repo()).thresholdOverrideRepo;
    await repo.replaceAll(overrides);
    _cache().set('cache:settings:threshold_overrides', overrides);
  } catch { /* background refresh — best effort */ }
}

export const saveThresholdOverrides = async (overrides: { subjectId: string; threshold: string }[]): Promise<void> => {
  const cache = _cache();
  // Optimistic local update so UI responds immediately
  const mapped = overrides.map(o => ({ subject_id: o.subjectId, threshold: parseFloat(o.threshold) || 70 } as any));
  cache.set('cache:settings:threshold_overrides', mapped);
  try {
    const response = await fetchWithFallback('/threshold-overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al guardar excepciones'); }
    const data = await parseJsonSafely(response);
    const items: ThresholdOverride[] = data?.overrides || [];
    const trepo = (await _repo()).thresholdOverrideRepo;
    await trepo.replaceAll(items);
    cache.set('cache:settings:threshold_overrides', items);
  } catch {
    await syncService.enqueueUpdate('threshold-overrides', 'all', { overrides });
    // Keep optimistic data in MMKV, sync will reconcile
  }
};

// ── Grading System ───────────────────────────────────────────

export const createCustomGradingSystem = async (data: {
  name: string; min_value: number; max_value: number; passing_value: number;
  precision?: number; type?: string; mode?: string; direction?: string;
}): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();

  try {
    const response = await fetchWithFallback('/grading-systems/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al crear escala'); }
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueCreate('grading-system', id, data);
    return { id, ...data, _isPending: true };
  }
};

// ── Two Factor ───────────────────────────────────────────────

export const getTwoFactorStatus = async (): Promise<TwoFactorStatus> => {
  const mmkv = require('react-native-mmkv').createMMKV();
  const cacheKey = 'cache:settings:two_factor_status';
  
  try {
    const response = await fetchWithFallback('/two-factor/status');
    if (!response.ok) throw new Error('Error al obtener estado 2FA');
    const data = await parseJsonSafely(response);
    mmkv.set(cacheKey, JSON.stringify(data));
    return data;
  } catch (error) {
    const cached = mmkv.getString(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
};

export const enableTwoFactor = async (): Promise<TwoFactorStatus> => {
  const response = await fetchWithFallback('/two-factor/enable', { method: 'POST' });
  if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al activar 2FA'); }
  return await parseJsonSafely(response);
};

export const disableTwoFactor = async (): Promise<TwoFactorStatus> => {
  const response = await fetchWithFallback('/two-factor/disable', { method: 'POST' });
  if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al desactivar 2FA'); }
  return await parseJsonSafely(response);
};

// ── LMS Accounts ─────────────────────────────────────────────

export const getLmsAccounts = async (): Promise<LmsAccount[]> => {
  const repo = (await _repo()).lmsAccountRepo;
  const cache = _cache();
  const local = await repo.getAll();
  if (local.length > 0) {
    _refreshLmsAccounts(repo, cache);
    return local;
  }
  try {
    const response = await fetchWithFallback('/lms-accounts');
    if (!response.ok) throw new Error('Error al obtener cuentas LMS');
    const data = await parseJsonSafely(response);
    const accounts: LmsAccount[] = data?.accounts || [];
    for (const a of accounts) await repo.upsert(a);
    cache.set('cache:settings:lms_accounts', accounts);
    return accounts;
  } catch (error) {
    const cached = cache.get('cache:settings:lms_accounts');
    if (cached) return cached as LmsAccount[];
    throw error;
  }
};

async function _refreshLmsAccounts(repo: any, cache: { set: (k: string, d: any) => void }) {
  try {
    const response = await fetchWithFallback('/lms-accounts');
    if (!response.ok) return;
    const data = await parseJsonSafely(response);
    const accounts: LmsAccount[] = data?.accounts || [];
    for (const a of accounts) await repo.upsert(a);
    cache.set('cache:settings:lms_accounts', accounts);
  } catch { /* background refresh — best effort */ }
}

export const addLmsAccount = async (platform: string, instance_url: string, username: string): Promise<LmsAccount> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();

  try {
    const response = await fetchWithFallback('/lms-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, platform, instance_url, username }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al vincular LMS'); }
    const result = await parseJsonSafely(response);
    const repo = (await _repo()).lmsAccountRepo;
    await repo.upsert(result);
    _cache().set('cache:settings:lms_accounts', await repo.getAll());
    return result;
  } catch {
    await syncService.enqueueCreate('lms-account', id, { platform, instance_url, username });
    const repo = (await _repo()).lmsAccountRepo;
    await repo.upsert({ id, platform, instance_url, username } as any);
    _cache().set('cache:settings:lms_accounts', await repo.getAll());
    return { id, platform, instance_url, username, _isPending: true } as any;
  }
};

export const removeLmsAccount = async (id: string): Promise<void> => {
  try {
    const response = await fetchWithFallback(`/lms-accounts/${id}`, { method: 'DELETE' });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al desvincular LMS'); }
    const repo = (await _repo()).lmsAccountRepo;
    await repo.delete(id);
    _cache().set('cache:settings:lms_accounts', await repo.getAll());
  } catch {
    await syncService.enqueueDelete('lms-account', id);
    const repo = (await _repo()).lmsAccountRepo;
    await repo.delete(id);
    _cache().set('cache:settings:lms_accounts', await repo.getAll());
  }
};

export const exportDataCsv = async (): Promise<Blob> => {
  const response = await fetchWithFallback('/export/csv');
  if (!response.ok) throw new Error('Error al exportar CSV');
  return await response.blob();
};

export const exportDataPdf = async (): Promise<Blob> => {
  const response = await fetchWithFallback('/export/pdf');
  if (!response.ok) throw new Error('Error al exportar PDF');
  return await response.blob();
};

export const sendFeedback = async (message: string): Promise<void> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();

  try {
    const response = await fetchWithFallback('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, message }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al enviar feedback'); }
  } catch {
    await syncService.enqueueCreate('feedback', id, { message });
  }
};
