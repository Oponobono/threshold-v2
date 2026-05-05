import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { fetchWithFallback, parseJsonSafely } from '../client';

/**
 * Obtiene el ID del usuario actual almacenado localmente
 */
export const getUserId = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('app_user_id');
  } else {
    return await SecureStore.getItemAsync('app_user_id');
  }
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

    // Guardar datos de sesión localmente para login automático tras registro
    const sessionToken = `dummy-token-${Date.now()}`;
    if (Platform.OS === 'web') {
      localStorage.setItem('app_session_token', sessionToken);
      localStorage.setItem('app_user_email', userData.email);
      localStorage.setItem('app_user_id', data.userId.toString());
    } else {
      await SecureStore.setItemAsync('app_session_token', sessionToken);
      await SecureStore.setItemAsync('app_user_email', userData.email);
      await SecureStore.setItemAsync('app_user_id', data.userId.toString());
    }

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

    // Guardar datos de sesión localmente
    const sessionToken = `dummy-token-${Date.now()}`; // En producción esto vendría del backend
    if (Platform.OS === 'web') {
      localStorage.setItem('app_session_token', sessionToken);
      localStorage.setItem('app_user_email', email);
      localStorage.setItem('app_user_id', data.user.id.toString());
    } else {
      await SecureStore.setItemAsync('app_session_token', sessionToken);
      await SecureStore.setItemAsync('app_user_email', email);
      await SecureStore.setItemAsync('app_user_id', data.user.id.toString());
    }

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
    if (Platform.OS === 'web') {
      localStorage.removeItem('app_session_token');
      localStorage.removeItem('app_user_email');
      localStorage.removeItem('app_user_id');
    } else {
      await SecureStore.deleteItemAsync('app_session_token');
      await SecureStore.deleteItemAsync('app_user_email');
      await SecureStore.deleteItemAsync('app_user_id');
    }
    console.log('[Auth] Sesión cerrada. Datos de autenticación eliminados.');
  } catch (error) {
    console.warn('[Auth] Advertencia al limpiar sesión:', error);
  }
};
