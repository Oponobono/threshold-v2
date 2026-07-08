import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { Course } from './types';
import { courseRepository, syncService } from '../database';
import { uuidv4 } from '../../utils/uuid';

const getUserIdNumber = async (): Promise<string> => {
  const uid = await getUserId();
  if (!uid) throw new Error('No hay sesión activa.');
  return String(uid);
};

let lastSyncTimestamp = 0;
let syncInProgress = false;
let fetchInProgress = false;
const SYNC_THROTTLE_MS = 30000;

export const getCourses = async (): Promise<Course[]> => {
  // 1. Leer localmente primero
  const localData = await courseRepository.getAll();

  // Si no hay datos locales, esperar red obligatoriamente
  if (!localData || localData.length === 0) {
    if (fetchInProgress) {
      return [];
    }
    fetchInProgress = true;
    try {
      const response = await fetchWithFallback('/courses');
      if (response.ok && !response.headers.get('X-Offline-Cache')) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) {
            await courseRepository.upsertFromCloud(c);
          }
          return data;
        }
      }
    } catch {}
    finally { fetchInProgress = false; }
    return [];
  }

  // 2. Sincronizar en background con throttling
  // OFFLINE-FIRST: solo crea registros nuevos del cloud, nunca sobreescribe locales.
  const now = Date.now();
  if (now - lastSyncTimestamp > SYNC_THROTTLE_MS && !syncInProgress) {
    syncInProgress = true;
    lastSyncTimestamp = now;
    (async () => {
      try {
        const response = await fetchWithFallback('/courses');
        if (response.ok && !response.headers.get('X-Offline-Cache')) {
          const data = await parseJsonSafely(response);
          if (Array.isArray(data)) {
            for (const c of data) {
              await courseRepository.upsertFromCloud(c);
            }
          }
        }
      } catch {}
      finally { syncInProgress = false; }
    })();
  }

  return localData;
};

export const createCourse = async (payload: {
  name: string;
  platform?: string;
  certificate_url?: string;
  main_url?: string;
  deep_link_url?: string;
  instructor?: string;
  total_hours?: number;
  total_classes?: number;
  tags?: string;
  global_notes?: string;
}): Promise<Course> => {
  const userId = await getUserIdNumber();
  const id = uuidv4();

  const course: Course = {
    id,
    user_id: userId,
    name: payload.name,
    platform: payload.platform,
    certificate_url: payload.certificate_url,
    main_url: payload.main_url,
    deep_link_url: payload.deep_link_url,
    instructor: payload.instructor,
    total_hours: payload.total_hours,
    total_classes: payload.total_classes || 0,
    completed_classes: 0,
    tags: payload.tags,
    global_notes: payload.global_notes,
    status: 'active',
    momentum_score: 1.0,
  };

  await courseRepository.create(course);

  try {
    const response = await fetchWithFallback('/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...course, user_id: userId }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await courseRepository.update(data.id, data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor al crear curso');
  } catch {
    await syncService.enqueueCreate('course', id, { ...course, user_id: userId });
    return course;
  }
};

export const updateCourse = async (id: string, payload: Partial<Course>): Promise<void> => {
  const userId = await getUserIdNumber();
  await courseRepository.update(id, payload);

  try {
    const response = await fetchWithFallback(`/courses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, user_id: userId }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error del servidor al actualizar curso');
    }
  } catch {
    await syncService.enqueueUpdate('course', id, { ...payload, user_id: userId });
  }
};

export const deleteCourse = async (id: string): Promise<void> => {
  await courseRepository.delete(id);

  try {
    const response = await fetchWithFallback(`/courses/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Error al eliminar curso');
    }
  } catch {
    await syncService.enqueueDelete('course', id);
  }
};
