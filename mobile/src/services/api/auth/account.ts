import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId, signOut } from './session';

/**
 * Solicita la eliminación de la cuenta (Soft Delete con 14 días de gracia)
 * Requiere contraseña para confirmación
 */
export const requestAccountDeletion = async (password: string) => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const response = await fetchWithFallback(`/users/${userId}/password-verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  
  const verifyData = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(verifyData?.error || 'Contraseña incorrecta');
  }

  // Si la contraseña es correcta, proceder con la eliminación
  const deleteResponse = await fetchWithFallback(`/users/${userId}`, {
    method: 'DELETE',
  });
  const deleteData = await parseJsonSafely(deleteResponse);
  if (!deleteResponse.ok) {
    throw new Error(deleteData?.error || 'Error al solicitar eliminación de cuenta');
  }
  
  // NO limpiar sesión aún, el usuario tiene 14 días para cambiar de idea
  return deleteData;
};

/**
 * Reactivar una cuenta que está pendiente de eliminación
 */
export const reactivateAccount = async (userId: string) => {
  const response = await fetchWithFallback(`/users/${userId}/reactivate`, {
    method: 'POST',
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al reactivar la cuenta');
  }
  return data;
};

/**
 * Obtener información de datos que se perderán al eliminar la cuenta
 */
export const getDeletionDataCount = async (userId: string) => {
  const response = await fetchWithFallback(`/users/${userId}/deletion-data-count`, {
    method: 'GET',
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al obtener información de datos');
  }
  return data;
};

/**
 * Deshabilita permanentemente la cuenta del usuario (Legacy - ahora es soft delete)
 */
export const disableAccount = async () => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const response = await fetchWithFallback(`/users/${userId}`, {
    method: 'DELETE',
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al deshabilitar la cuenta');
  }
  
  // Limpiar sesión localmente
  await signOut();
  return data;
};
