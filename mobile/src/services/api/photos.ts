import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { Photo } from './types';
import { photoRepository, syncService } from '../database';
import { getBackupPreferences } from '../backup/backupService';

export const getGalleryItems = async () => {
  const userId = await getUserId();
  if (!userId) return [];
  
  // 1. Leer localmente primero
  const localData = await photoRepository.getAll();

  if (!localData || localData.length === 0) {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return [];
      const response = await fetchWithFallback(`/gallery/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const p of data) await photoRepository.upsert(p);
          return data;
        }
      }
    } catch {}
    return [];
  }
  
  // Sync attempt in background — solo si el usuario habilitó auto-upload
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return;
      const response = await fetchWithFallback(`/gallery/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const p of data) await photoRepository.upsert(p);
        }
      }
    } catch {}
  })();

  return localData;
};

export const createPhoto = async (photoData: {
  id?: string;
  subject_id: string;
  local_uri: string;
  es_favorita?: number;
  ocr_text?: string | null;
  group_id?: string | null;
}) => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = photoData.id || uuidv4();
  const userId = await getUserId();

  // 1. Guardar SIEMPRE en SQLite local primero — la galería funciona sin red
  const photo: any = { id, ...photoData };
  await photoRepository.create(photo);

  // 2. Sincronizar con la nube SOLO si el usuario habilitó auto-upload (background, no bloqueante)
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload || !prefs?.includePhotos) return;
      const response = await fetchWithFallback('/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...photoData, userId, id }),
      });
      const data = await parseJsonSafely(response);
      if (response.ok && data) {
        await photoRepository.upsert(data);
      } else {
        throw new Error(data?.error || 'Error del servidor');
      }
    } catch {
      // Auto-upload falló o está desactivado: encolar para cuando haya red/backup manual
      await syncService.enqueueCreate('photo', id, { ...photoData, userId });
    }
  })();

  return photo;
};

export const getPhotosBySubject = async (subjectId: string): Promise<Photo[]> => {
  // Siempre retorna datos locales inmediatamente
  const localData = await photoRepository.getBySubject(subjectId) as Photo[];
  
  // Actualizar desde la nube en background si auto-upload activo
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return;
      const response = await fetchWithFallback(`/photos/${subjectId}`);
      const data = await parseJsonSafely(response);
      if (response.ok && Array.isArray(data)) {
        for (const p of data) await photoRepository.upsert(p);
      }
    } catch {}
  })();

  return localData;
};

export const deletePhoto = async (photoId: string) => {
  // 1. Borrar localmente de forma inmediata
  await photoRepository.delete(photoId);

  // 2. Sincronizar la eliminación en background
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) {
        await syncService.enqueueDelete('photo', photoId);
        return;
      }
      const userId = await getUserId();
      const response = await fetchWithFallback(`/photos/${photoId}?userId=${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        await syncService.enqueueDelete('photo', photoId);
      }
    } catch {
      await syncService.enqueueDelete('photo', photoId);
    }
  })();

  return { success: true };
};

export const updatePhoto = async (photoId: string, data: { ocr_text?: string; tags?: string; es_favorita?: boolean }) => {
  // 1. Actualizar localmente de forma inmediata (optimistic update garantizado)
  await photoRepository.update(photoId, data as Partial<Photo>);

  // 2. Sincronizar con la nube en background si auto-upload activo
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) {
        const uid = await getUserId();
        await syncService.enqueueUpdate('photo', photoId, { ...data, userId: uid });
        return;
      }
      const userId = await getUserId();
      const response = await fetchWithFallback(`/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      });
      if (!response.ok) {
        const uid = await getUserId();
        await syncService.enqueueUpdate('photo', photoId, { ...data, userId: uid });
      }
    } catch {
      const uid = await getUserId();
      await syncService.enqueueUpdate('photo', photoId, { ...data, userId: uid });
    }
  })();

  return { ...data };
};

export const searchPhotosByTag = async (subjectId: string, tag: string): Promise<Photo[]> => {
  try {
    const response = await fetchWithFallback(`/photos/${subjectId}/search?tag=${encodeURIComponent(tag)}`);
    const data = await parseJsonSafely(response);
    return data || [];
  } catch {
    return [];
  }
};
