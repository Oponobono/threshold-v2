import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { scheduleRepository, syncService } from '../database';
import { requireActiveSubject } from '../domain/invariants';

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
  const allLocal = await scheduleRepository.getByUser(userId);
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
            for (const s of mapped) await scheduleRepository.upsertFromCloud(s);
          }
        }
      } catch {}
      finally { todaySyncInProgress = false; }
    })();
  }

  return localToday;
};

export const createSchedule = async (payload: { subject_id: string; day_of_week: number; start_time: string; end_time: string }) => {
  const { uuidv4 } = await import('../../utils/uuid');
  const userId = await getUserIdNumber();
  const id = (payload as any).id || uuidv4();

  await requireActiveSubject(payload.subject_id);

  const schedule: any = { id, user_id: userId, ...payload };
  await scheduleRepository.create(schedule);

  try {
    const response = await fetchWithFallback('/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await scheduleRepository.update(data.id, data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('schedule', id, payload);
    return schedule;
  }
};

export const deleteSchedule = async (id: string) => {
  await scheduleRepository.delete(id);

  try {
    const response = await fetchWithFallback(`/schedules/${id}`, { method: 'DELETE' });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('schedule', id);
    return { success: true, _isPending: true };
  }
};

export const getSchedulesBySubject = async (subjectId: string): Promise<any[]> => {
  const userId = await getUserIdNumber();
  
  // 1. Leer localmente primero
  const localData = await scheduleRepository.getBySubject(subjectId);

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
            for (const s of mapped) await scheduleRepository.upsertFromCloud(s);
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
  const localData = await scheduleRepository.getByUser(userId);

  if (!localData || localData.length === 0) {
    try {
      const response = await fetchWithFallback(`/schedules/user/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          const mapped = data.map(s => ({ ...s, user_id: userId }));
          for (const s of mapped) await scheduleRepository.upsertFromCloud(s);
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
            for (const s of mapped) await scheduleRepository.upsertFromCloud(s);
          }
        }
      } catch {}
      finally { allSyncInProgress = false; }
    })();
  }

  return localData;
};
