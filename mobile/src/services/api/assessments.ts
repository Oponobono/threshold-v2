import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { Assessment } from './types';
import { assessmentRepository, syncService, subjectRepository } from '../database';

const getUserIdNumber = async (): Promise<string> => {
  const uid = await getUserId();
  if (!uid) throw new Error('No hay sesión activa.');
  return String(uid);
};

export const getAssessments = async (subjectId: string): Promise<Assessment[]> => {
  // 1. Leer localmente primero
  const localData = await assessmentRepository.getBySubject(subjectId) as Assessment[];

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/assessments/${subjectId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const a of data) await assessmentRepository.upsert(a);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const getAllAssessments = async (): Promise<Assessment[]> => {
  const userId = await getUserIdNumber();
  
  // 1. Leer localmente primero
  const localData = await assessmentRepository.getAll() as Assessment[];

  if (!localData || localData.length === 0) {
    try {
      const response = await fetchWithFallback(`/assessments/user/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const a of data) await assessmentRepository.upsert(a);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/assessments/user/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const a of data) await assessmentRepository.upsert(a);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const createAssessment = async (payload: Assessment): Promise<Assessment> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();

  const assessment: Assessment = {
    ...payload,
    id,
    _isPending: true,
    is_completed: payload.is_completed ?? 0,
  } as Assessment;

  await assessmentRepository.create(assessment);

  try {
    const response = await fetchWithFallback('/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assessment),
    });
    const data = await parseJsonSafely(response);
    if (data?.id) {
      await assessmentRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('assessment', id, assessment);
    return assessment;
  }
};

export const updateAssessment = async (id: string, payload: Partial<Assessment>): Promise<any> => {
  await assessmentRepository.update(id, payload);

  try {
    const response = await fetchWithFallback(`/assessments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(response);
    if (response.ok) {
      await assessmentRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueUpdate('assessment', id, payload);
    return { success: true, message: 'Guardado localmente' };
  }
};

export const deleteAssessment = async (id: string) => {
  await assessmentRepository.delete(id);

  try {
    const response = await fetchWithFallback(`/assessments/${id}`, { method: 'DELETE' });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('assessment', id);
    return { success: true, _isPending: true };
  }
};

export const getProjectionAnalytics = async (subjectId: string) => {
  try {
    const response = await fetchWithFallback(`/assessments/analytics/subject/${subjectId}/projection`);
    const data = await parseJsonSafely(response);
    if (response.ok && data) return data;
    return null;
  } catch {
    return null;
  }
};
