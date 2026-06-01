import { fetchWithFallback, parseJsonSafely } from './client';
import { cacheService, saveToCacheSync, loadFromCacheSync } from '../cacheService';
import { offlineSyncService } from '../offlineSyncService';

export interface GradingPeriod {
  id: number;
  user_id: number;
  name: string;
  period_type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_at: string;
}

export interface ThresholdOverride {
  id: number;
  user_id: number;
  subject_id: number;
  subject_name?: string;
  subject_color?: string;
  threshold: number;
}

export interface LmsAccount {
  id: number;
  user_id: number;
  platform: string;
  instance_url: string;
  username: string;
  created_at: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  secret?: string;
}

export const getGradingPeriods = async (): Promise<GradingPeriod[]> => {
  try {
    const response = await fetchWithFallback('/grading-periods');
    if (!response.ok) throw new Error('Error al obtener períodos');
    const data = await parseJsonSafely(response);
    const periods = data?.periods || [];
    if (periods.length > 0) {
      await cacheService.saveGradingSystems(periods);
    }
    return periods;
  } catch (error) {
    console.warn('[Settings] Network error, loading grading periods from cache:', error);
    const cached = await cacheService.loadGradingSystems();
    if (cached) {
      console.log('[Settings] ✅ Loaded grading periods from cache (offline mode)');
      return cached as GradingPeriod[];
    }
    throw error;
  }
};

export const createGradingPeriod = async (name: string, period_type: string = 'custom', start_date?: string, end_date?: string): Promise<any> => {
  try {
    const response = await fetchWithFallback('/grading-periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, period_type, start_date: start_date || null, end_date: end_date || null }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al crear período'); }
    return await parseJsonSafely(response);
  } catch (error) {
    console.warn('[Settings] Offline: encolando createGradingPeriod', error);
    await offlineSyncService.addPendingOperation('POST', '/grading-periods', 'settings', { name, period_type, start_date, end_date });
    return { id: -Date.now(), name, period_type, _isPending: true };
  }
};

export const deleteGradingPeriod = async (id: number): Promise<void> => {
  try {
    const response = await fetchWithFallback(`/grading-periods/${id}`, { method: 'DELETE' });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al eliminar período'); }
  } catch (error) {
    console.warn(`[Settings] Offline: encolando deleteGradingPeriod ${id}`, error);
    await offlineSyncService.addPendingOperation('DELETE', `/grading-periods/${id}`, 'settings');
  }
};

const CACHE_KEY_THRESHOLD_OVERRIDES = 'cache:threshold_overrides';
const TTL_THRESHOLD_OVERRIDES = 1000 * 60 * 5; // 5 min

export const getThresholdOverrides = async (): Promise<ThresholdOverride[]> => {
  const cached = loadFromCacheSync<ThresholdOverride[]>(CACHE_KEY_THRESHOLD_OVERRIDES, TTL_THRESHOLD_OVERRIDES);
  if (cached) return cached;

  const response = await fetchWithFallback('/threshold-overrides');
  if (!response.ok) throw new Error('Error al obtener excepciones');
  const data = await parseJsonSafely(response);
  const overrides = data?.overrides || [];
  saveToCacheSync(CACHE_KEY_THRESHOLD_OVERRIDES, overrides);
  return overrides;
};

export const saveThresholdOverrides = async (overrides: { subjectId: number; threshold: string }[]): Promise<void> => {
  try {
    const response = await fetchWithFallback('/threshold-overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al guardar excepciones'); }
  } catch (error) {
    console.warn('[Settings] Offline: encolando saveThresholdOverrides', error);
    await offlineSyncService.addPendingOperation('PUT', '/threshold-overrides', 'settings', { overrides });
  }
};

export const createCustomGradingSystem = async (data: {
  name: string; min_value: number; max_value: number; passing_value: number;
  precision?: number; type?: string; mode?: string; direction?: string;
}): Promise<any> => {
  try {
    const response = await fetchWithFallback('/grading-systems/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al crear escala'); }
    return await parseJsonSafely(response);
  } catch (error) {
    console.warn('[Settings] Offline: encolando createCustomGradingSystem', error);
    await offlineSyncService.addPendingOperation('POST', '/grading-systems/custom', 'settings', data);
    return { id: -Date.now(), ...data, _isPending: true };
  }
};

export const getTwoFactorStatus = async (): Promise<TwoFactorStatus> => {
  const response = await fetchWithFallback('/two-factor/status');
  if (!response.ok) throw new Error('Error al obtener estado 2FA');
  return await parseJsonSafely(response);
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

export const getLmsAccounts = async (): Promise<LmsAccount[]> => {
  const response = await fetchWithFallback('/lms-accounts');
  if (!response.ok) throw new Error('Error al obtener cuentas LMS');
  const data = await parseJsonSafely(response);
  return data?.accounts || [];
};

export const addLmsAccount = async (platform: string, instance_url: string, username: string): Promise<LmsAccount> => {
  try {
    const response = await fetchWithFallback('/lms-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, instance_url, username }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al vincular LMS'); }
    return await parseJsonSafely(response);
  } catch (error) {
    console.warn('[Settings] Offline: encolando addLmsAccount', error);
    await offlineSyncService.addPendingOperation('POST', '/lms-accounts', 'settings', { platform, instance_url, username });
    return { id: -Date.now(), platform, instance_url, username, _isPending: true } as any;
  }
};

export const removeLmsAccount = async (id: number): Promise<void> => {
  try {
    const response = await fetchWithFallback(`/lms-accounts/${id}`, { method: 'DELETE' });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al desvincular LMS'); }
  } catch (error) {
    console.warn(`[Settings] Offline: encolando removeLmsAccount ${id}`, error);
    await offlineSyncService.addPendingOperation('DELETE', `/lms-accounts/${id}`, 'settings');
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
  try {
    const response = await fetchWithFallback('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al enviar feedback'); }
  } catch (error) {
    console.warn('[Settings] Offline: encolando sendFeedback', error);
    await offlineSyncService.addPendingOperation('POST', '/feedback', 'settings', { message });
  }
};
