import { fetchWithFallback, parseJsonSafely } from '../client';
import { UserProfile } from '../types';
import { getUserId } from './session';

/**
 * Obtiene el perfil del usuario actual
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  const response = await fetchWithFallback(`/users/${userId}`);
  if (!response.ok) return null;
  return await parseJsonSafely(response);
};

/**
 * Actualiza el perfil del usuario (nombre, apellido, usuario, universidad)
 */
export const updateUserProfile = async (payload: {
  name?: string;
  lastname?: string;
  username?: string;
  university?: string;
  share_pin?: string;
}) => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const response = await fetchWithFallback(`/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al actualizar el perfil');
  }
  return data;
};

/**
 * Actualiza la contraseña del usuario
 */
export const updateUserPassword = async (currentPassword: string, newPassword: string) => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const response = await fetchWithFallback(`/users/${userId}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al actualizar la contraseña');
  }
  return data;
};
