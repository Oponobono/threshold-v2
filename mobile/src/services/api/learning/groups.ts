/**
 * groups.ts
 *
 * Servicio para la gestión de grupos colaborativos de estudio.
 * Un grupo se identifica por un PIN único (`group_pin_id`) que el docente
 * o creador comparte con sus alumnos para que puedan unirse.
 */
import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId } from '../auth';

/** Representa la membresía de un usuario a un grupo colaborativo */
export interface GroupMembership {
  id?: number;
  user_id?: number;
  group_pin_id: string;
  role?: string;
  joined_at?: string;
}

/** Obtiene todos los grupos a los que pertenece el usuario autenticado */
export const getUserGroups = async (): Promise<GroupMembership[]> => {
  try {
    const userId = await getUserId();
    if (!userId) return [];
    
    const response = await fetchWithFallback(`/learning/groups/${userId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      console.warn('[getUserGroups] Error:', data?.error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.warn('[getUserGroups] Network error:', error.message);
    return [];
  }
};

/** Une al usuario autenticado a un grupo mediante su PIN de acceso */
export const joinGroup = async (group_pin_id: string): Promise<any> => {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error('Usuario no autenticado');

    const response = await fetchWithFallback('/learning/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, group_pin_id }),
    });
    
    const responseData = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(responseData?.error || 'Error al unirse al grupo');
    }
    return responseData;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar unirse al grupo');
  }
};

/** Elimina al usuario autenticado de un grupo (abandono voluntario) */
export const leaveGroup = async (group_pin_id: string): Promise<any> => {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error('Usuario no autenticado');

    const response = await fetchWithFallback('/learning/groups/leave', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, group_pin_id }),
    });
    
    const responseData = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(responseData?.error || 'Error al salir del grupo');
    }
    return responseData;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar salir del grupo');
  }
};
