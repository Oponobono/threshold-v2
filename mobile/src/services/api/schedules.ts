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
    return {
      id: -1, // ID temporal
      ...payload,
      _isPending: true, // Bandera para UI
    };
  }
};

/**
 * Elimina un horario
 */
export const deleteSchedule = async (id: number) => {
  return await fetchWithFallback(`/schedules/${id}`, { method: 'DELETE' });
};

/**
 * Obtiene horarios por materia
 */
export const getSchedulesBySubject = async (subjectId: number): Promise<any[]> => {
  const response = await fetchWithFallback(`/schedules/subject/${subjectId}`);
  return (await parseJsonSafely(response)) || [];
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
  return Array.isArray(data) ? data : [];
};
