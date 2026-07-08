import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { Photo } from './types';
import { photoRepository, syncService } from '../database';
import { requireActiveSubject, requireActivePhoto } from '../domain/invariants';
import { getBackupPreferences } from '../backup/backupService';
import { assetSyncEngine } from '../sync/asset/AssetSyncEngine';
import { uuidv4 } from '../../utils/uuid';

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
          for (const p of data) await photoRepository.upsertFromCloud(p);
          return data;
        }
      }
    } catch {}
    return [];
  }
  
  // Sync attempt in background — solo si el usuario habilitó auto-upload (solo crea registros nuevos)
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return;
      const response = await fetchWithFallback(`/gallery/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const p of data) await photoRepository.upsertFromCloud(p);
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
  const id = photoData.id || uuidv4();
  const userId = await getUserId();

  await requireActiveSubject(photoData.subject_id);

  // 1. Guardar SIEMPRE en SQLite local primero — la galería funciona sin red
  const photo: any = { id, ...photoData };
  await photoRepository.create(photo);

  // Schedule file upload via asset pipeline (background, with retry + progress)
  assetSyncEngine.scheduleUpload('photo', id, photoData.local_uri, 'image/jpeg', `${id}.jpg`);

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
        await photoRepository.update(data.id, data);
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
        for (const p of data) await photoRepository.upsertFromCloud(p);
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
  await requireActivePhoto(photoId);

  // 1. Actualizar localmente de forma inmediata (optimistic update garantizado)
  await photoRepository.update(photoId, data as any);

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
  // 1. Búsqueda local en SQLite (tags + ocr_text) — funciona 100% offline
  try {
    const localResults = await photoRepository.searchByTagOrOcr(subjectId, tag);
    if (localResults.length > 0) {
      // Sincronizar en background para tener resultados de la nube también
      (async () => {
        try {
          const response = await fetchWithFallback(`/photos/${subjectId}/search?tag=${encodeURIComponent(tag)}`);
          const data = await parseJsonSafely(response);
          if (response.ok && Array.isArray(data)) {
            for (const p of data) await photoRepository.upsertFromCloud(p);
          }
        } catch {}
      })();
      return localResults as Photo[];
    }
  } catch (localErr) {
    console.warn('[searchPhotosByTag] Error en búsqueda local:', localErr);
  }

  // 2. Fallback a API si no hubo resultados locales
  try {
    const response = await fetchWithFallback(`/photos/${subjectId}/search?tag=${encodeURIComponent(tag)}`);
    const data = await parseJsonSafely(response);
    if (response.ok && Array.isArray(data)) {
      // Persistir resultados para futuras búsquedas offline (solo registros nuevos)
      for (const p of data) {
        try { await photoRepository.upsertFromCloud(p); } catch {}
      }
      return data;
    }
    return data || [];
  } catch {
    return [];
  }
};
