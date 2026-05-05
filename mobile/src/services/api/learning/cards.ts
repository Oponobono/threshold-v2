/**
 * cards.ts
 *
 * Servicio para el registro y consulta de logs de tarjetas flash (card_logs).
 * Cada log almacena el resultado de una respuesta ('learning' | 'review'),
 * el tiempo de respuesta en milisegundos y el timestamp de la sesión.
 * Estos datos alimentan el sistema de repetición espaciada y las analíticas de estudio.
 */
import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId } from '../auth';

/** Registro de una respuesta del alumno a una tarjeta flash durante una sesión */
export interface CardLog {
  id?: number;
  card_id: number;
  user_id?: number;
  result?: string | null;
  response_time_ms?: number | null;
  timestamp?: string;
}

/** Obtiene el historial completo de respuestas de tarjetas del usuario autenticado */
export const getCardLogs = async (): Promise<CardLog[]> => {
  try {
    const userId = await getUserId();
    if (!userId) return [];
    
    const response = await fetchWithFallback(`/learning/card_logs/${userId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      console.warn('[getCardLogs] Error:', data?.error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.warn('[getCardLogs] Network error:', error.message);
    return [];
  }
};

/**
 * Registra el resultado de una tarjeta revisada.
 * El `user_id` se inyecta automáticamente desde el almacenamiento seguro.
 */
export const createCardLog = async (
  logData: Omit<CardLog, 'id' | 'timestamp' | 'user_id'>
): Promise<any> => {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error('Usuario no autenticado');

    const response = await fetchWithFallback('/learning/card_logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...logData, user_id: userId }),
    });
    
    const responseData = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(responseData?.error || 'Error al registrar log de tarjeta');
    }
    return responseData;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al crear el log de tarjeta');
  }
};
