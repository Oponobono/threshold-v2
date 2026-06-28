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
          if (data && !pendingDelete.has(subjectId)) {
            await subjectRepository.upsertFromCloud(data);
          }
        }
      } catch {}
      finally { subjectByIdSyncInProgress = false; }
    })();
  }

  return localData;
};

const filterDeleted = (subjects: Subject[]): Subject[] =>
  subjects.filter(s => !pendingDelete.has(s.id));

/**
 * Fusiona datos del servidor con el registro local preservando campos
 * que pueden ser nulos en el servidor por condiciones de carrera de FK
 * (ej: course_id si el curso aún no se sincronizó al servidor).
 * 
 * IMPORTANTE: serverSubject.course_id toma precedencia si es no nulo.
 * Solo se usa el valor local como fallback cuando el servidor devuelve null,
 * lo que indica una condición de carrera temporal (el curso aún no sincronizó).
 */
const mergeWithLocal = async (serverSubject: Subject): Promise<Subject> => {
  const localRecord = await subjectRepository.getById(serverSubject.id);
  if (!localRecord) return serverSubject;
  return {
    ...serverSubject,
    // Preservar el valor local si el servidor devuelve null (condición de carrera:
    // el curso aún no se sincronizó o el servidor no tiene el campo).
    // Solo sobreescribir cuando el servidor envía un valor no nulo.
    course_id: serverSubject.course_id != null
      ? serverSubject.course_id
      : (localRecord.course_id ?? null),
    external_url: serverSubject.external_url != null
      ? serverSubject.external_url
      : (localRecord.external_url ?? null),
    total_lessons: Math.max(serverSubject.total_lessons ?? 0, localRecord.total_lessons ?? 0),
    completed_lessons: Math.max(serverSubject.completed_lessons ?? 0, localRecord.completed_lessons ?? 0),
    next_micro_milestone: serverSubject.next_micro_milestone != null
      ? serverSubject.next_micro_milestone
      : (localRecord.next_micro_milestone ?? null),
  };
};

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
          for (const s of data) {
            if (!pendingDelete.has(s.id)) {
              await subjectRepository.upsertFromCloud(s);
            }
          }
          return filterDeleted(data);
        }
      }
    } catch {}
    finally { fetchInProgress = false; }
    return [];
  }

  // 2. Sincronizar en background con throttling para evitar 429
  // OFFLINE-FIRST: solo crea registros nuevos del cloud, nunca sobreescribe locales.
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
            for (const s of data) {
              if (!pendingDelete.has(s.id)) {
                await subjectRepository.upsertFromCloud(s);
              }
            }
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
  course_id?: string | null;
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
    course_id: payload.course_id ?? null,
    avg_score: 0,
    normalized_avg_score: 0,
    completion_percent: 0,
  };

  await subjectRepository.create(subject);
  await updateCourseCounters(subject.course_id);

  try {
    const response = await fetchWithFallback('/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id, user_id: userId }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      const merged = await mergeWithLocal(data);
      await subjectRepository.update(data.id, merged);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('subject', id, { ...payload, user_id: userId });
    return subject;
  }
};

export const updateCourseCounters = async (courseId: string | null | undefined): Promise<void> => {
  if (!courseId) return;
  try {
    const { courseRepository } = await import('../database/repositories/CourseRepository');
    const linked = await subjectRepository.getByField('course_id', courseId);
    const total = linked.reduce((sum, s) => sum + ((s as any).total_lessons ?? 0), 0);
    const completed = linked.reduce((sum, s) => sum + ((s as any).completed_lessons ?? 0), 0);
    // Solo sobrescribir si hay materias vinculadas (cursos planos preservan su valor manual)
    if (linked.length > 0) {
      const course = await courseRepository.getById(courseId);
      const newTotalClasses = course?.total_classes ? course.total_classes : total;
      await courseRepository.update(courseId, {
        total_classes: newTotalClasses as any,
        completed_classes: completed as any,
      } as any);
    }
  } catch (e) {
    console.warn('[updateCourseCounters] Error:', e);
  }
};

export const updateSubject = async (subjectId: string, payload: Partial<Subject>): Promise<any> => {
  // 1. Leer subject actual para detectar cambio de course_id
  const prev = await subjectRepository.getById(subjectId);

  // 2. Persistir localmente primero (offline-first)
  await subjectRepository.update(subjectId, payload);

  // 3. Actualizar contadores del curso anterior y nuevo si cambió course_id
  if (prev?.course_id !== payload.course_id) {
    await updateCourseCounters(prev?.course_id);
    await updateCourseCounters(payload.course_id);
  }

  try {
    const response = await fetchWithFallback(`/subjects/${subjectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(response);
    if (response.ok) {
      // El backend devuelve la materia completa; si no tiene id es la respuesta
      // antigua {success: true} — en ese caso usar el payload local como fuente de verdad.
      if (data?.id) {
        const merged = await mergeWithLocal(data);
        await subjectRepository.update(data.id, merged);
        return merged;
      }
      // Respuesta sin id (backend antiguo): enriquecer localmente desde SQLite
      const fresh = await subjectRepository.getById(subjectId);
      return fresh ?? payload;
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

/**
 * Repara enlaces curso-materia perdidos y actualiza contadores.
 * Se ejecuta en cada inicio de app vía loadAllData().
 *
 * 1. Recalcula total_classes / completed_classes de cada curso
 *    a partir de las materias vinculadas en SQLite local.
 * 2. Si una materia tiene course_id pero el curso no existe localmente,
 *    desvincula la materia (course_id = null).
 */
export const repairSubjectCourseLinks = async (): Promise<void> => {
  try {
    const { courseRepository } = await import('../database/repositories/CourseRepository');
    const subjects = await subjectRepository.getAll();
    const courses = await courseRepository.getAll();
    const courseIds = new Set(courses.map(c => c.id));

    // Desvincular materias cuyo curso fue eliminado
    for (const sub of subjects) {
      if (sub.course_id && !courseIds.has(sub.course_id)) {
        await subjectRepository.update(sub.id, { course_id: null });
      }
    }

    // Recalcular contadores de cada curso (solo si tiene materias vinculadas)
    for (const course of courses) {
      const linked = subjects.filter(s => s.course_id === course.id);
      if (linked.length === 0) continue; // cursos planos preservan su valor manual
      const total = linked.reduce((sum, s) => sum + (s.total_lessons ?? 0), 0);
      const completed = linked.reduce((sum, s) => sum + (s.completed_lessons ?? 0), 0);
      
      const newTotalClasses = course.total_classes ? course.total_classes : total;
      
      if (course.total_classes !== newTotalClasses || course.completed_classes !== completed) {
        await courseRepository.update(course.id, {
          total_classes: newTotalClasses,
          completed_classes: completed,
        });
      }
    }
  } catch (e) {
    console.warn('[repairSubjectCourseLinks] Error:', e);
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
