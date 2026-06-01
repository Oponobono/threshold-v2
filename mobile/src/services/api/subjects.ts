/**
 * subjects.ts
 *
 * Servicio CRUD para las materias académicas del usuario.
 * Una materia es la entidad central del ecosistema Threshold: agrupa grabaciones,
 * fotos, documentos, flashcards, horarios y evaluaciones.
 * Incluye el endpoint de predicción que sugiere la materia activa según el horario actual.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { Subject } from './types';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import { offlineSyncService } from '../offlineSyncService';

/**
 * Obtiene una materia específica.
 * Estrategia: Network First con fallback al caché MMKV de subjects cuando la red falla.
 * Esto garantiza que la pantalla de detalle de materia no quede vacía en modo offline.
 */
export const getSubjectById = async (subjectId: number | string): Promise<Subject | null> => {
  try {
    const response = await fetchWithFallback(`/subject/${subjectId}`);
    if (response.ok) {
      const data = await parseJsonSafely(response);
      return data;
    }
    // Si la respuesta no es ok, intentar caché MMKV
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    // Fallback: buscar en el caché MMKV de subjects
    console.warn(`[Subjects] getSubjectById(${subjectId}) falló (${(error as Error)?.message}), buscando en caché MMKV...`);
    try {
      const cached = cacheService.loadSubjectsSync() as Subject[] | null;
      if (Array.isArray(cached)) {
        const found = cached.find(s => String(s.id) === String(subjectId)) ?? null;
        if (found) {
          console.log(`[Subjects] ✅ Materia ${subjectId} encontrada en caché MMKV`);
        } else {
          console.warn(`[Subjects] ⚠️ Materia ${subjectId} NO encontrada en caché MMKV`);
        }
        return found;
      }
    } catch (cacheError) {
      console.error('[Subjects] Error al leer caché MMKV:', cacheError);
    }
    return null;
  }
};

/**
 * Obtiene las materias del usuario
 */
export const getSubjects = async () => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');
  const response = await fetchWithFallback(`/subjects/${userId}`);
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error al obtener materias.');
  }
  const data = await parseJsonSafely(response);
  if (Array.isArray(data)) {
    cacheService.saveSubjects(data);
    return data;
  }
  return [];
};

/**
 * Crea una materia para el usuario actual
 * Si falla la red, guarda en cola offline para sincronizar después
 */
export const createSubject = async (payload: {
  name: string;
  professor?: string;
  color?: string;
  icon?: string;
  credits?: number;
  target_grade?: number;
}) => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('No hay sesión activa.');
  }

  const payloadWithUser = {
    user_id: Number(userId),
    ...payload,
  };

  try {
    const response = await fetchWithFallback('/subjects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadWithUser),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo crear la materia.');
    }

    cacheService.clearKey(CACHE_KEYS.SUBJECTS);
    return data as Subject;
  } catch (error) {
    // Si falla, guardar en cola offline
    console.warn('[Subjects] Red no disponible, guardando en cola offline:', error);
    await offlineSyncService.addPendingOperation(
      'POST',
      '/subjects',
      'subject',
      payloadWithUser
    );
    
    // Retornar objeto temporal con datos del payload para que la UI sea optimista
    return {
      id: -1, // ID temporal
      user_id: Number(userId),
      name: payload.name,
      code: '',
      professor: payload.professor,
      color: payload.color || '#CCCCCC',
      icon: payload.icon || 'book-outline',
      target_grade: payload.target_grade,
      avg_score: 0,
      normalized_avg_score: 0,
      completion_percent: 0,
      credits: payload.credits || 0,
      _isPending: true, // Bandera para UI
    } as any;
  }
};

/**
 * Consulta el servidor para obtener la materia más probable según los bloques
 * de horario que coincidan con la hora y día actuales del usuario.
 */
export const getPredictedSubject = async (): Promise<Subject | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const response = await fetchWithFallback(`/prediction/${userId}`);
  return await parseJsonSafely(response);
};

/**
 * Elimina una materia
 */
export const deleteSubject = async (subjectId: number | string) => {
  try {
    const response = await fetchWithFallback(`/subjects/${subjectId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await parseJsonSafely(response);
      throw new Error(errorData?.error || 'No se pudo eliminar la materia.');
    }
    cacheService.clearKey(CACHE_KEYS.SUBJECTS);
    return await parseJsonSafely(response);
  } catch (error) {
    console.warn('[Subjects] Red no disponible, guardando en cola offline:', error);
    await offlineSyncService.addPendingOperation('DELETE', `/subjects/${subjectId}`, 'subject');
    return { success: true, _isPending: true };
  }
};

/**
 * Actualiza una materia existente
 */
export const updateSubject = async (subjectId: number | string, payload: Partial<Subject>) => {
  try {
    const response = await fetchWithFallback(`/subjects/${subjectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo actualizar la materia.');
    }

    cacheService.clearKey(CACHE_KEYS.SUBJECTS);
    return data;
  } catch (error) {
    console.warn('[Subjects] Red no disponible, guardando update en cola offline:', error);
    await offlineSyncService.addPendingOperation('PUT', `/subjects/${subjectId}`, 'subject', payload);
    return { ...payload, _isPending: true };
  }
};
