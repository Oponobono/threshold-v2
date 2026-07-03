import { fetchWithFallback, parseJsonSafely } from '../client';
import { getUserId } from './session';
import { storageService } from '../../storageService';

/**
 * Registra el token biométrico del dispositivo en el backend para un usuario autenticado.
 * @param userId ID del usuario
 * @param biometricToken Token UUID generado de forma segura en el dispositivo
 */
export const enrollBiometric = async (userId: string, biometricToken: string): Promise<void> => {
  const response = await fetchWithFallback('/auth/enroll-biometric', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, biometric_token: biometricToken }),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al registrar biometría.');
  }
};

/**
 * Autentica al usuario usando el token biométrico almacenado en el dispositivo.
 * La huella dactilar NUNCA sale del dispositivo — el OS la valida localmente.
 * @param biometricToken Token recuperado del SecureStore tras validación del OS
 */
export const biometricLogin = async (biometricToken: string) => {
  const response = await fetchWithFallback('/biometric-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ biometric_token: biometricToken }),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Autenticación biométrica fallida.');
  }

  // Guardar sesión igual que en loginUser
  const token = data.token || `dummy-token-${Date.now()}`;
  await storageService.saveSecure('jwt_token', token);
  await storageService.saveSecure('app_user_email', data.user.email);
  await storageService.saveSecure('app_user_id', data.user.id.toString());

  return data;
};

/**
 * Revoca el token biométrico en el servidor
 */
export const removeBiometricToken = async () => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const response = await fetchWithFallback(`/users/${userId}/biometric`, {
    method: 'DELETE',
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al eliminar token biométrico');
  }
  return data;
};
