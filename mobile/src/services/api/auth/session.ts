import { storageService } from '../../storageService';
import { fetchWithFallback, parseJsonSafely } from '../client';

/**
 * Obtiene el ID del usuario actual almacenado localmente
 */
export const getUserId = async (): Promise<string | null> => {
  return await storageService.getSecure('app_user_id');
};

/**
 * Registra un nuevo usuario en la base de datos
 */
export const registerUser = async (userData: {
  email: string;
  password?: string;
  name?: string;
  lastname?: string;
  username?: string;
  grading_scale?: string;
  approval_threshold?: number;
  major?: string;
  university?: string;
  semester?: string;
  study_goal?: string;
  reference_language?: string;
  profile_image?: string;  // URL pública de Firebase Storage
}) => {
  try {
    const response = await fetchWithFallback('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error en el registro');
    }

    // 🛡️ Fase 5: Guardar el token real devuelto por el backend
    const token = data.token || `dummy-token-${Date.now()}`;
    await storageService.saveSecure('jwt_token', token);
    await storageService.saveSecure('app_user_email', userData.email);
    await storageService.saveSecure('app_user_id', data.userId.toString());

    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar registrar');
  }
};

/**
 * Inicia sesión de un usuario existente
 */
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await fetchWithFallback('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error en el login');
    }

    // 🛡️ Fase 5: Guardar el token real devuelto por el backend
    const token = data.token || `dummy-token-${Date.now()}`; 
    await storageService.saveSecure('jwt_token', token);
    await storageService.saveSecure('app_user_email', email);
    await storageService.saveSecure('app_user_id', data.user.id.toString());

    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar iniciar sesión');
  }
};

/**
 * Cierra la sesión del usuario eliminando todos los datos
 * de autenticación almacenados localmente en el dispositivo.
 * El device_id se preserva para seguir contando visitas futuras.
 */
export const signOut = async (): Promise<void> => {
  try {
    await storageService.removeSecure('jwt_token');
    await storageService.removeSecure('app_user_email');
    await storageService.removeSecure('app_user_id');
    console.log('[Auth] Sesión cerrada. Datos de autenticación eliminados.');
  } catch (error) {
    console.warn('[Auth] Advertencia al limpiar sesión:', error);
  }
};
