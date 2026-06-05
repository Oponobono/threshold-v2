import { fetchWithFallback, parseJsonSafely } from '../client';
import { UserProfile } from '../types';
import { getUserId } from './session';
import { storageService } from '../../storageService';
import { downloadProfileImage, clearProfileImageCache } from '../../profileImageCache';

const PROFILE_CACHE_KEY = 'app:cached_profile';

/**
 * Obtiene el perfil del usuario actual con caché persistente.
 * Cache-first: devuelve datos cacheados instantáneamente,
 * luego refresca desde el servidor en segundo plano.
 */
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const freshProfile = await fetchProfileFromServer();
  if (freshProfile) {
    await storageService.saveLocal(PROFILE_CACHE_KEY, JSON.stringify(freshProfile));
    if (freshProfile.profile_image) {
      await downloadProfileImage(freshProfile.profile_image);
    }
    return freshProfile;
  }

  const cached = await getCurrentUserProfileSync();
  if (cached) return cached;

  return null;
};

/**
 * Obtiene el perfil desde caché (sin red).
 * Útil para hidratación instantánea de UI.
 */
export const getCurrentUserProfileSync = async (): Promise<UserProfile | null> => {
  try {
    const raw = await storageService.getLocal(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
};

const fetchProfileFromServer = async (): Promise<UserProfile | null> => {
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
  major?: string;
  university?: string;
  semester?: string;
  study_goal?: string;
  share_pin?: string;
  approval_threshold?: number;
  active_grading_version_id?: number | null;
  grading_scale?: string;
  profile_image?: string | null;
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

  const hasImagePayload = 'profile_image' in payload;
  if (hasImagePayload) {
    if (payload.profile_image === null || payload.profile_image === undefined) {
      await clearProfileImageCache();
    } else {
      await downloadProfileImage(payload.profile_image);
    }
  }

  const freshProfile = await fetchProfileFromServer();
  if (freshProfile) {
    await storageService.saveLocal(PROFILE_CACHE_KEY, JSON.stringify(freshProfile));
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

/**
 * Actualiza la foto de perfil del usuario guardando la URL de Firebase Storage
 */
export const updateProfileImage = async (profileImageUrl: string) => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const response = await fetchWithFallback(`/users/${userId}/profile-image`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_image: profileImageUrl }),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'Error al actualizar la foto de perfil');
  }
  return data;
};
