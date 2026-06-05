import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { Subject } from './types';
import { subjectRepository, syncService } from '../database';

const getUserIdNumber = async (): Promise<string> => {
  const uid = await getUserId();
  if (!uid) throw new Error('No hay sesión activa.');
  return String(uid);
};

export const getSubjectById = async (subjectId: string): Promise<Subject | null> => {
  // 1. Leer localmente primero
  const localData = await subjectRepository.getById(subjectId);

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/subject/${subjectId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (data) await subjectRepository.upsert(data);
      }
    } catch {}
  })();

  return localData;
};

export const getSubjects = async (): Promise<Subject[]> => {
  const userId = await getUserIdNumber();
  
  // 1. Leer localmente primero
  const localData = await subjectRepository.getByUser(userId);

  // Si no hay datos locales (primer inicio o caché limpia), esperar la red obligatoriamente
  if (!localData || localData.length === 0) {
    try {
      const response = await fetchWithFallback(`/subjects/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const s of data) await subjectRepository.upsert(s);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/subjects/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const s of data) await subjectRepository.upsert(s);
        }
      }
    } catch {}
  })();

  return localData;
};

export const createSubject = async (payload: {
  id?: string;
  name: string;
  professor?: string;
  color?: string;
  icon?: string;
  credits?: number;
  target_grade?: number;
}): Promise<Subject> => {
  const userId = await getUserIdNumber();
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();

  const subject: Subject = {
    id,
    user_id: userId,
    code: payload.name?.substring(0, 3).toUpperCase() || '',
    name: payload.name,
    professor: payload.professor,
    color: payload.color || '#CCCCCC',
    icon: payload.icon || 'book-outline',
    credits: payload.credits || 0,
    target_grade: payload.target_grade,
    avg_score: 0,
    normalized_avg_score: 0,
    completion_percent: 0,
  };

  await subjectRepository.create(subject);

  try {
    const response = await fetchWithFallback('/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id, user_id: userId }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await subjectRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('subject', id, { ...payload, user_id: userId });
    return subject;
  }
};

export const updateSubject = async (subjectId: string, payload: Partial<Subject>): Promise<any> => {
  await subjectRepository.update(subjectId, payload);

  try {
    const response = await fetchWithFallback(`/subjects/${subjectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await subjectRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueUpdate('subject', subjectId, payload);
    return { ...payload, _isPending: true };
  }
};

export const deleteSubject = async (subjectId: string) => {
  await subjectRepository.delete(subjectId);

  try {
    const response = await fetchWithFallback(`/subjects/${subjectId}`, { method: 'DELETE' });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('subject', subjectId);
    return { success: true, _isPending: true };
  }
};

export const getPredictedSubject = async (): Promise<Subject | null> => {
  const userId = await getUserIdNumber();
  try {
    const response = await fetchWithFallback(`/prediction/${userId}`);
    return await parseJsonSafely(response);
  } catch {
    return null;
  }
};
