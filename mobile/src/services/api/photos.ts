/**
 * photos.ts
 *
 * Servicio CRUD para la galería de fotos del usuario.
 * Las fotos son capturadas con `PhotoCaptureModal` (cámara nativa) y quedan
 * vinculadas a una materia específica. También incluye la galería global del usuario
 * que agrega fotos y documentos escaneados de todas las materias.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { Photo } from './types';
import { offlineSyncService } from '../offlineSyncService';

/**
 * Obtiene ítems de la galería
 */
export const getGalleryItems = async () => {
  const userId = await getUserId();
  if (!userId) return [];
  const response = await fetchWithFallback(`/gallery/${userId}`);
  return (await parseJsonSafely(response)) || [];
};

/**
 * Crea una nueva entrada de foto en la base de datos.
 * Acepta ocr_text opcional para que el asistente IA pueda leerlo directamente sin acceder al archivo.
 * Si falla la red, guarda en cola offline para sincronizar después
 */
export const createPhoto = async (photoData: {
  subject_id: number;
  local_uri: string;
  es_favorita?: number;
  /** Texto extraído por OCR — alimenta el contexto del asistente IA */
  ocr_text?: string | null;
  /** ID para agrupar múltiples fotos */
  group_id?: string | null;
}) => {
  try {
    const response = await fetchWithFallback('/photos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(photoData),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al guardar la foto en la base de datos');
    }

    return data;
  } catch (error) {
    // Si falla, guardar en cola offline
    console.warn('[Photos] Red no disponible, guardando foto en cola offline:', error);
    await offlineSyncService.addPendingOperation(
      'POST',
      '/photos',
      'photo',
      photoData
    );
    
    // Retornar objeto temporal para que la UI sea optimista
    return {
      id: -1, // ID temporal
      ...photoData,
      _isPending: true, // Bandera para UI
    };
  }
};
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar guardar la foto');
  }
};

/**
 * Obtiene las fotos de una materia específica
 */
export const getPhotosBySubject = async (subjectId: number): Promise<Photo[]> => {
  try {
    const response = await fetchWithFallback(`/photos/${subjectId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      console.warn('[getPhotosBySubject] Error:', data?.error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.warn('[getPhotosBySubject] Network error:', error?.message || String(error) || 'Unknown error');
    return [];
  }
};

/**
 * Elimina una foto por ID
 */
export const deletePhoto = async (photoId: number) => {
  try {
    const response = await fetchWithFallback(`/photos/${photoId}`, {
      method: 'DELETE',
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al eliminar la foto');
    }
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar eliminar la foto');
  }
};

/**
 * Actualiza una foto (ej: guardar OCR extraído posteriormente y tags generados)
 */
export const updatePhoto = async (photoId: number, data: { ocr_text?: string; tags?: string; es_favorita?: boolean }) => {
  try {
    const response = await fetchWithFallback(`/photos/${photoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(result?.error || 'Error al actualizar la foto');
    }

    return result;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar actualizar la foto');
  }
};

/**
 * Busca fotos por etiqueta/palabra clave en una materia
 */
export const searchPhotosByTag = async (subjectId: number, tag: string): Promise<Photo[]> => {
  try {
    const response = await fetchWithFallback(`/photos/${subjectId}/search?tag=${encodeURIComponent(tag)}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      console.warn('[searchPhotosByTag] Error:', data?.error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.warn('[searchPhotosByTag] Network error:', error.message);
    return [];
  }
};
