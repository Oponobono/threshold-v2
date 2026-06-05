import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId } from '../auth';
import { studySessionRepository, syncService } from '../../database';
import type { StudySession } from '../types';

export type { StudySession };

export const getStudySessions = async (): Promise<StudySession[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  // 1. Leer localmente primero
  const localData = await studySessionRepository.getAll();

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/learning/sessions/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const s of data) await studySessionRepository.upsert(s);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const createStudySession = async (sessionData: Omit<StudySession, 'id' | 'start_timestamp' | 'user_id'>): Promise<any> => {
  const { uuidv4 } = await import('../../../utils/uuid');
  const id = uuidv4();
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  const session: any = { id, user_id: String(userId), ...sessionData };
  await studySessionRepository.create(session);

  try {
    const response = await fetchWithFallback('/learning/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sessionData, id, user_id: userId }),
    });
    const responseData = await parseJsonSafely(response);
    if (response.ok) return responseData;
    throw new Error(responseData?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('study-session', id, { ...sessionData, user_id: userId });
    return session;
  }
};
