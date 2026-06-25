import { storageService } from '../../storageService';
import { fetchWithFallback, parseJsonSafely } from '../client';
import { databaseService } from '../../database/DatabaseService';
import { clearProfileImageCache } from '../../profileImageCache';
import { clearAllUserData } from '../../sessionClearService';

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
  active_grading_version_id?: number | null;
  study_goal?: string;
  reference_language?: string;
  profile_image?: string;
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
 * Verifica si existe una sesión válida verificando si hay token JWT almacenado
 */
export const hasValidSession = async (): Promise<boolean> => {
  try {
    const token = await storageService.getSecure('jwt_token');
    const userId = await storageService.getSecure('app_user_id');
    const email = await storageService.getSecure('app_user_email');
    
    // Sesión válida si existen todos los datos de autenticación
    return !!(token && userId && email);
  } catch (error) {
    console.warn('[Auth] Error verificando sesión:', error);
    return false;
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
    
    // Limpiar SQLite
    await databaseService.clearAll();
    await clearProfileImageCache();

    // Limpiar TODOS los datos de usuario: MMKV (mazos, cartas, reviews) + AsyncStorage (caché)
    // Esto evita que una cuenta nueva vea datos residuales de la sesión anterior.
    await clearAllUserData();
    
    console.log('[Auth] Sesión cerrada. Datos de autenticación, SQLite, MMKV y caché eliminados.');
  } catch (error) {
    console.warn('[Auth] Advertencia al limpiar sesión:', error);
  }
};

/**
 * Solicita un código OTP para recuperar la contraseña.
 * Envía un correo electrónico con el código al email especificado.
 */
export const forgotPassword = async (email: string): Promise<void> => {
  const response = await fetchWithFallback('/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al enviar el código de recuperación.');
  }
};

/**
 * Verifica el código OTP y actualiza la contraseña del usuario.
 */
export const resetPassword = async (email: string, code: string, newPassword: string): Promise<void> => {
  const response = await fetchWithFallback('/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al restablecer la contraseña.');
  }
};
