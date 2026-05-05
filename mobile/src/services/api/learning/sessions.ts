/**
 * sessions.ts
 *
 * Servicio para el registro y consulta de sesiones de estudio.
 * Soporta dos tipos de sesión:
 * - `Pomodoro`: Cuenta regresiva con duración fija configurada por el usuario.
 * - `Threshold`: Cuenta progresiva de tiempo trabajado sin límite predefinido.
 * Cada sesión guarda la materia activa, la duración real y una valoración de rendimiento.
 */
import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId } from '../auth';

/** Representa una sesión de estudio temporizada registrada en la plataforma */
export interface StudySession {
  id?: number;
  user_id?: number;
  subject_id?: number | null;
  session_type: 'Pomodoro' | 'Threshold';
  config_value?: number | null;
  duration_seconds: number;
  performance_rating?: number | null;
  start_timestamp?: string;
}

/** Obtiene el historial de sesiones de estudio del usuario autenticado */
export const getStudySessions = async (): Promise<StudySession[]> => {
  try {
    const userId = await getUserId();
    if (!userId) return [];
    
    const response = await fetchWithFallback(`/learning/sessions/${userId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      console.warn('[getStudySessions] Error:', data?.error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.warn('[getStudySessions] Network error:', error.message);
    return [];
  }
};

/**
 * Guarda una nueva sesión de estudio completada.
 * El `user_id` y el `start_timestamp` son inyectados automáticamente por el servidor.
 */
export const createStudySession = async (
  sessionData: Omit<StudySession, 'id' | 'start_timestamp' | 'user_id'>
): Promise<any> => {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error('Usuario no autenticado');

    const response = await fetchWithFallback('/learning/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sessionData, user_id: userId }),
    });
    
    const responseData = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(responseData?.error || 'Error al guardar la sesión de estudio');
    }
    return responseData;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al crear la sesión');
  }
};
