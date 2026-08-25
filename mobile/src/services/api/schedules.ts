import { fetchWithFallback, parseJsonSafely } from './client';
import { RepositoryFactory } from '../database/RepositoryFactory';
import { getUserId } from './auth';
import { syncService } from '../database';
import { requireActiveSubject } from '../domain/invariants';
import { uuidv4 } from '../../utils/uuid';

const getUserIdNumber = async (): Promise<string> => {
  const uid = await getUserId();
  if (!uid) throw new Error('No hay sesión activa.');
  return String(uid);
};

let lastTodaySync = 0;
let lastAllSync = 0;
let lastSubjectSync = 0;
let todaySyncInProgress = false;
let allSyncInProgress = false;
let subjectSyncInProgress = false;
const SYNC_THROTTLE_MS = 30000;

export const getTodaySchedules = async (): Promise<any[]> => {
  const userId = await getUserIdNumber();
  
  // 1. Leer localmente primero
  const allLocal = await RepositoryFactory.schedules().getAll();
  const today = new Date().getDay();
  const localToday = allLocal.filter(s => s.day_of_week === today);

  // 2. Sincronizar en background con throttling (solo crea registros nuevos, nunca sobreescribe)
  const now = Date.now();
  if (now - lastTodaySync > SYNC_THROTTLE_MS && !todaySyncInProgress) {
    todaySyncInProgress = true;
    lastTodaySync = now;
    (async () => {
      try {
        const response = await fetchWithFallback(`/schedules/today/${userId}`);
        if (response.ok) {
          const data = await parseJsonSafely(response);
          if (Array.isArray(data)) {
            const mapped = data.map(s => ({ ...s, user_id: userId }));
            for (const s of mapped) await RepositoryFactory.schedules().upsert(s);
          }
        }
      } catch {}
      finally { todaySyncInProgress = false; }
    })();
  }

  return localToday;
};

export const createSchedule = async (payload: { subject_id: string; day_of_week: number; start_time: string; end_time: string }) => {
  const userId = await getUserIdNumber();
  const id = (payload as any).id || uuidv4();

  await requireActiveSubject(payload.subject_id);

  const schedule: any = { id, user_id: userId, ...payload };
  await RepositoryFactory.schedules().create(schedule);

  // El backend usa clientId || uuidv4(): si no enviamos el id local,
  // el servidor genera otro UUID y el pull posterior duplica la fila.
  const syncPayload = { ...payload, id };

  fetchWithFallback('/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncPayload),
  }).then(async (response) => {
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await RepositoryFactory.schedules().update(data.id, data);
    } else {
      await syncService.enqueueCreate('schedule', id, syncPayload);
    }
  }).catch(() => {
    syncService.enqueueCreate('schedule', id, syncPayload);
  });

  return schedule;
};

export const deleteSchedule = async (id: string) => {
  await RepositoryFactory.schedules().delete(id);

  fetchWithFallback(`/schedules/${id}`, { method: 'DELETE' })
    .then((response) => parseJsonSafely(response))
    .catch(() => syncService.enqueueDelete('schedule', id));

  return { success: true };
};

export const getSchedulesBySubject = async (subjectId: string): Promise<any[]> => {
  const userId = await getUserIdNumber();
  
  // 1. Leer localmente primero
  const localData = await RepositoryFactory.schedules().getByField('subject_id', subjectId);

  // 2. Sincronizar en background con throttling (solo crea registros nuevos, nunca sobreescribe)
  const now = Date.now();
  if (now - lastSubjectSync > SYNC_THROTTLE_MS && !subjectSyncInProgress) {
    subjectSyncInProgress = true;
    lastSubjectSync = now;
    (async () => {
      try {
        const response = await fetchWithFallback(`/schedules/subject/${subjectId}`);
        if (response.ok) {
          const data = await parseJsonSafely(response);
          if (Array.isArray(data)) {
            const mapped = data.map(s => ({ ...s, user_id: userId }));
            for (const s of mapped) await RepositoryFactory.schedules().upsert(s);
          }
        }
      } catch {}
      finally { subjectSyncInProgress = false; }
    })();
  }

  return localData || [];
};

export const getAllSchedules = async (): Promise<any[]> => {
  const userId = await getUserIdNumber();
  
  // 1. Leer localmente primero
  const localData = await RepositoryFactory.schedules().getAll();

  if (!localData || localData.length === 0) {
    try {
      const response = await fetchWithFallback(`/schedules/user/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          const mapped = data.map(s => ({ ...s, user_id: userId }));
          for (const s of mapped) await RepositoryFactory.schedules().upsert(s);
          return mapped;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en background con throttling (solo crea registros nuevos, nunca sobreescribe)
  const now = Date.now();
  if (now - lastAllSync > SYNC_THROTTLE_MS && !allSyncInProgress) {
    allSyncInProgress = true;
    lastAllSync = now;
    (async () => {
      try {
        const response = await fetchWithFallback(`/schedules/user/${userId}`);
        if (response.ok) {
          const data = await parseJsonSafely(response);
          if (Array.isArray(data)) {
            const mapped = data.map(s => ({ ...s, user_id: userId }));
            for (const s of mapped) await RepositoryFactory.schedules().upsert(s);
          }
        }
      } catch {}
      finally { allSyncInProgress = false; }
    })();
  }

  return localData;
};
