/**
 * audio.ts
 *
 * Servicio CRUD para grabaciones de voz (.m4a) del usuario.
 * Los archivos físicos se guardan localmente con `expo-file-system`; este servicio
 * persiste la referencia (URI) y metadatos en la BD del servidor para sincronización
 * entre dispositivos. También gestiona los registros de transcripciones y resúmenes
 * generados por Groq Whisper que se almacenan como archivos locales adicionales.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { AudioRecording } from './types';
import { offlineSyncService } from '../offlineSyncService';
import { storageService } from '../storageService';
import { cacheService, CACHE_KEYS } from '../cacheService';

/**
 * Obtiene todas las grabaciones de audio del usuario
 */
export const getAudioRecordings = async (): Promise<AudioRecording[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  const response = await fetchWithFallback(`/audio-recordings/${userId}`);
  return (await parseJsonSafely(response)) || [];
};

/**
 * Crea una nueva grabación de audio
 */
export const createAudioRecording = async (payload: {
  subject_id?: number | null;
  name?: string | null;
  local_uri: string;
  duration?: number;
}) => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const payloadWithUser = { ...payload, user_id: Number(userId) };

  try {
    const response = await fetchWithFallback('/audio-recordings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadWithUser),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo guardar la grabación en BD.');
    }

    return data;
  } catch (error) {
    console.warn('[Audio] Offline: encolando createAudioRecording', error);
    await offlineSyncService.addPendingOperation('POST', '/audio-recordings', 'audio', payloadWithUser);
    const optimisticAudio = { id: -Date.now(), ...payloadWithUser, _isPending: true };
    cacheService.addOptimisticItem(CACHE_KEYS.AUDIO_RECORDINGS, optimisticAudio);
    if (payloadWithUser.subject_id) {
      cacheService.addOptimisticItem(`api_cache_/audio-recordings/subject/${payloadWithUser.subject_id}`, optimisticAudio);
    }
    return optimisticAudio;
  }
};

/**
 * Actualiza una grabación (ej: asociar materia o renombrar)
 */
export const updateAudioRecording = async (id: number, payload: { subject_id?: number | null; name?: string | null }) => {
  try {
    const response = await fetchWithFallback(`/audio-recordings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo actualizar la grabación.');
    }

    return data;
  } catch (error) {
    console.warn(`[Audio] Offline: encolando updateAudioRecording ${id}`, error);
    await offlineSyncService.addPendingOperation('PUT', `/audio-recordings/${id}`, 'audio', payload);
    cacheService.updateOptimisticItem(CACHE_KEYS.AUDIO_RECORDINGS, id, payload);
    return { ...payload, _isPending: true };
  }
};

/**
 * Elimina una grabación de la base de datos
 */
export const deleteAudioRecording = async (id: number) => {
  try {
    const response = await fetchWithFallback(`/audio-recordings/${id}`, { method: 'DELETE' });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo eliminar la grabación.');
    }
    return data;
  } catch (error) {
    console.warn(`[Audio] Offline: encolando deleteAudioRecording ${id}`, error);
    await offlineSyncService.addPendingOperation('DELETE', `/audio-recordings/${id}`, 'audio');
    const userId = await getUserId();
    if (userId) {
      const cacheKey = `api_cache_/audio-recordings/${userId}`;
      try { await storageService.removeLocal(cacheKey); } catch {}
    }
    cacheService.removeOptimisticItem(CACHE_KEYS.AUDIO_RECORDINGS, id);
    return { success: true, _isPending: true };
  }
};

/**
 * Crea o actualiza la transcripción de una grabación.
 * Ahora soporta texto inline (transcript_text) además de URI de archivo.
 * Priorizar transcript_text si está disponible, ya que el backend lo leerá
 * directamente sin necesidad de acceder al sistema de archivos.
 */
export const upsertAudioTranscript = async (payload: {
  recording_id: number;
  transcript_uri?: string | null;
  transcript_text?: string | null;
  summary_uri?: string | null;
}) => {
  try {
    const response = await fetchWithFallback('/audio-transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'No se pudo guardar la transcripción.');
    }

    return data;
  } catch (error) {
    console.warn('[Audio] Offline: encolando upsertAudioTranscript', error);
    await offlineSyncService.addPendingOperation('POST', '/audio-transcripts', 'audio', payload);
    return { ...payload, _isPending: true };
  }
};
