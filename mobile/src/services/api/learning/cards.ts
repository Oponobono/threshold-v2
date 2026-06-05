import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId } from '../auth';
import { cardLogRepository, syncService } from '../../database';
import type { CardLog } from '../types';

export type { CardLog };

export const getCardLogs = async (): Promise<CardLog[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  // 1. Leer localmente primero
  const localData = await cardLogRepository.getAll();

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/learning/card_logs/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const l of data) await cardLogRepository.upsert(l);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const createCardLog = async (logData: Omit<CardLog, 'id' | 'timestamp' | 'user_id'>): Promise<any> => {
  const { uuidv4 } = await import('../../../utils/uuid');
  const id = uuidv4();
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  const log: any = { id, user_id: String(userId), ...logData };
  await cardLogRepository.create(log);

  try {
    const response = await fetchWithFallback('/learning/card_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...logData, id, user_id: userId }),
    });
    const responseData = await parseJsonSafely(response);
    if (response.ok) return responseData;
    throw new Error(responseData?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('card-log', id, { ...logData, user_id: userId });
    return log;
  }
};
