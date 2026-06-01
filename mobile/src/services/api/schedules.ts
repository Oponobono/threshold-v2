/**
 * schedules.ts
 *
 * Servicio CRUD para los horarios académicos del usuario.
 * Cada horario define un bloque de clase semanal (`day_of_week`, `start_time`, `end_time`)
 * vinculado a una materia. Los horarios son utilizados por el dashboard para mostrar
 * la clase actual y por el sistema de predicción de materia activa.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';
import { offlineSyncService } from '../offlineSyncService';

/**
 * Obtiene los horarios de hoy
 */
export const getTodaySchedules = async (): Promise<any[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  const response = await fetchWithFallback(`/schedules/today/${userId}`);
  return (await parseJsonSafely(response)) || [];
};

/**
 * Crea un nuevo horario (soporta repetición enviando múltiples peticiones si es necesario)
 * Si falla la red, guarda en cola offline para sincronizar después
 */
export const createSchedule = async (payload: { subject_id: number, day_of_week: number, start_time: string, end_time: string }) => {
  try {
    const response = await fetchWithFallback('/schedules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo crear el horario.');
    }

    cacheService.clearKey(CACHE_KEYS.SCHEDULES);
    return data;
  } catch (error) {
    // Si falla, guardar en cola offline
    console.warn('[Schedules] Red no disponible, guardando en cola offline:', error);
    await offlineSyncService.addPendingOperation(
      'POST',
      '/schedules',
      'schedule',
      payload
    );
    
    // Retornar objeto temporal para que la UI sea optimista
    const optimisticSchedule = {
      id: -Date.now(), // ID temporal único
      ...payload,
      _isPending: true, // Bandera para UI
    };
    cacheService.addOptimisticItem(CACHE_KEYS.SCHEDULES, optimisticSchedule);
    return optimisticSchedule;
  }
};

/**
 * Elimina un horario
 */
export const deleteSchedule = async (id: number) => {
  try {
    const response = await fetchWithFallback(`/schedules/${id}`, { method: 'DELETE' });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo eliminar el horario.');
    }
    cacheService.clearKey(CACHE_KEYS.SCHEDULES);
    return data;
  } catch (error) {
    console.warn('[Schedules] Red no disponible, guardando eliminación en cola offline:', error);
    await offlineSyncService.addPendingOperation('DELETE', `/schedules/${id}`, 'schedule');
    cacheService.removeOptimisticItem(CACHE_KEYS.SCHEDULES, id);
    return { success: true, _isPending: true };
  }
};

/**
 * Obtiene horarios por materia.
 * Fallback offline: busca en el caché MMKV de schedules globales.
 */
export const getSchedulesBySubject = async (subjectId: number): Promise<any[]> => {
  try {
    const response = await fetchWithFallback(`/schedules/subject/${subjectId}`);
    const data = await parseJsonSafely(response);
    if (response.ok && Array.isArray(data)) {
      return data;
    }
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.warn(`[Schedules] getSchedulesBySubject(${subjectId}) falló, buscando en caché MMKV...`);
    try {
      const cached = cacheService.loadSchedulesSync() as any[] | null;
      if (Array.isArray(cached)) {
        return cached.filter(s => String(s.subject_id) === String(subjectId));
      }
    } catch (cacheError) {
      console.error('[Schedules] Error al leer caché MMKV:', cacheError);
    }
    return [];
  }
};

/**
 * Obtiene todos los horarios del usuario
 */
export const getAllSchedules = async (): Promise<any[]> => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');
  const response = await fetchWithFallback(`/schedules/user/${userId}`);
  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error al obtener horarios.');
  }
  const data = await parseJsonSafely(response);
  if (Array.isArray(data)) {
    cacheService.saveSchedules(data);
    return data;
  }
  return [];
};
