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

export const getGradingPeriods = async (): Promise<GradingPeriod[]> => {
  const mmkv = require('react-native-mmkv').createMMKV();
  const cacheKey = 'cache:settings:grading_periods';
  
  try {
    const response = await fetchWithFallback('/grading-periods');
    if (!response.ok) throw new Error('Error al obtener períodos');
    const data = await parseJsonSafely(response);
    const periods = data?.periods || [];
    mmkv.set(cacheKey, JSON.stringify(periods));
    return periods;
  } catch (error) {
    const cached = mmkv.getString(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
};

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
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueCreate('grading-period', id, { name, period_type, start_date, end_date });
    return { id, name, period_type, _isPending: true };
  }
};

export const deleteGradingPeriod = async (id: string): Promise<void> => {
  try {
    const response = await fetchWithFallback(`/grading-periods/${id}`, { method: 'DELETE' });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al eliminar período'); }
  } catch {
    await syncService.enqueueDelete('grading-period', id);
  }
};

export const getThresholdOverrides = async (): Promise<ThresholdOverride[]> => {
  const mmkv = require('react-native-mmkv').createMMKV();
  const cacheKey = 'cache:settings:threshold_overrides';
  
  try {
    const response = await fetchWithFallback('/threshold-overrides');
    if (!response.ok) throw new Error('Error al obtener excepciones');
    const data = await parseJsonSafely(response);
    const overrides = data?.overrides || [];
    mmkv.set(cacheKey, JSON.stringify(overrides));
    return overrides;
  } catch (error) {
    const cached = mmkv.getString(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
};

export const saveThresholdOverrides = async (overrides: { subjectId: string; threshold: string }[]): Promise<void> => {
  try {
    const response = await fetchWithFallback('/threshold-overrides', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides }),
    });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al guardar excepciones'); }
  } catch {
    await syncService.enqueueUpdate('threshold-overrides', 'all', { overrides });
  }
};

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

export const getLmsAccounts = async (): Promise<LmsAccount[]> => {
  const mmkv = require('react-native-mmkv').createMMKV();
  const cacheKey = 'cache:settings:lms_accounts';
  
  try {
    const response = await fetchWithFallback('/lms-accounts');
    if (!response.ok) throw new Error('Error al obtener cuentas LMS');
    const data = await parseJsonSafely(response);
    const accounts = data?.accounts || [];
    mmkv.set(cacheKey, JSON.stringify(accounts));
    return accounts;
  } catch (error) {
    const cached = mmkv.getString(cacheKey);
    if (cached) return JSON.parse(cached);
    throw error;
  }
};

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
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueCreate('lms-account', id, { platform, instance_url, username });
    return { id, platform, instance_url, username, _isPending: true } as any;
  }
};

export const removeLmsAccount = async (id: string): Promise<void> => {
  try {
    const response = await fetchWithFallback(`/lms-accounts/${id}`, { method: 'DELETE' });
    if (!response.ok) { const e = await parseJsonSafely(response); throw new Error(e?.error || 'Error al desvincular LMS'); }
  } catch {
    await syncService.enqueueDelete('lms-account', id);
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
