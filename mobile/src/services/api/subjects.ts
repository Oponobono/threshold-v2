import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { Subject } from './types';
import { subjectRepository, syncService } from '../database';
import { storageService } from '../storageService';

const getUserIdNumber = async (): Promise<string> => {
  const uid = await getUserId();
  if (!uid) throw new Error('No hay sesión activa.');
  return String(uid);
};

let lastSyncTimestamp = 0;
let syncInProgress = false;
let fetchInProgress = false;
const SYNC_THROTTLE_MS = 30000;
const pendingDelete = new Set<string>();

// Seguimiento separado para getSubjectById — no debe compartir lastSyncTimestamp
// con getSubjects para evitar que una función interrumpa el throttle de la otra.
let lastSubjectByIdSyncTimestamp = 0;
let subjectByIdSyncInProgress = false;
const lastSubjectSyncTimestamps = new Map<string, number>();

const SUBJECT_BY_ID_THROTTLE_MS = 30000;

export const getSubjectById = async (subjectId: string): Promise<Subject | null> => {
  if (pendingDelete.has(subjectId)) return null;

  // 1. Leer localmente primero
  const localData = await subjectRepository.getById(subjectId);

  // 2. Sincronizar en background con throttling separado del de getSubjects
  //    y con debounce por materia para evitar llamadas redundantes.
  const now = Date.now();
  const lastPerSubject = lastSubjectSyncTimestamps.get(subjectId) || 0;
  if (
    now - lastSubjectByIdSyncTimestamp > SUBJECT_BY_ID_THROTTLE_MS &&
    now - lastPerSubject > SUBJECT_BY_ID_THROTTLE_MS &&
    !subjectByIdSyncInProgress
  ) {
    subjectByIdSyncInProgress = true;
    lastSubjectByIdSyncTimestamp = now;
    lastSubjectSyncTimestamps.set(subjectId, now);
    (async () => {
      try {
        const response = await fetchWithFallback(`/subject/${subjectId}`);
        if (response.ok) {
          const data = await parseJsonSafely(response);
          if (data && !pendingDelete.has(subjectId)) await subjectRepository.upsert(data);
        }
      } catch {}
      finally { subjectByIdSyncInProgress = false; }
    })();
  }

  return localData;
};

const filterDeleted = (subjects: Subject[]): Subject[] =>
  subjects.filter(s => !pendingDelete.has(s.id));

export const getSubjects = async (): Promise<Subject[]> => {
  const userId = await getUserIdNumber();
  
  // 1. Leer localmente primero
  const localData = await subjectRepository.getByUser(userId);

  // Si no hay datos locales (primer inicio o caché limpia), esperar la red obligatoriamente
  if (!localData || localData.length === 0) {
    if (fetchInProgress) {
      return [];
    }
    fetchInProgress = true;
    try {
      const response = await fetchWithFallback(`/subjects/${userId}`);
      if (response.ok && !response.headers.get('X-Offline-Cache')) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const s of data) if (!pendingDelete.has(s.id)) await subjectRepository.upsert(s);
          return filterDeleted(data);
        }
      }
    } catch {}
    finally { fetchInProgress = false; }
    return [];
  }

  // 2. Sincronizar en background con throttling para evitar 429
  const now = Date.now();
  if (now - lastSyncTimestamp > SYNC_THROTTLE_MS && !syncInProgress) {
    syncInProgress = true;
    lastSyncTimestamp = now;
    (async () => {
      try {
        const response = await fetchWithFallback(`/subjects/${userId}`);
        if (response.ok && !response.headers.get('X-Offline-Cache')) {
          const data = await parseJsonSafely(response);
          if (Array.isArray(data)) {
            for (const s of data) if (!pendingDelete.has(s.id)) await subjectRepository.upsert(s);
          }
        }
      } catch {}
      finally { syncInProgress = false; }
    })();
  }

  return filterDeleted(localData);
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
  pendingDelete.add(subjectId);
  await subjectRepository.delete(subjectId);

  // Invalidar toda caché relacionada con subjects para evitar que una lectura
  // posterior (loadAllData, getSubjectById) en modo offline restaure la materia
  // desde la caché obsoleta.
  const userId = await getUserIdNumber();
  await Promise.all([
    storageService.removeLocal(`api_cache_/subjects/${userId}`).catch(() => {}),
    storageService.removeLocal(`api_cache_/subject/${subjectId}`).catch(() => {}),
    storageService.removeLocal(`api_cache_/subjects/user/${userId}`).catch(() => {}),
    storageService.removeLocal(`api_cache_/subjects/${userId}?`).catch(() => {}),
  ]);
  // Resetear timestamp de sync para que el próximo getSubjects/getSubjectById
  // no haga background sync con caché obsoleta.
  lastSyncTimestamp = Date.now();

  try {
    const response = await fetchWithFallback(`/subjects/${subjectId}`, { method: 'DELETE' });
    pendingDelete.delete(subjectId);
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('subject', subjectId);
    pendingDelete.delete(subjectId);
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
