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
};

/**
 * Actualiza una grabación (ej: asociar materia o renombrar)
 */
export const updateAudioRecording = async (id: number, payload: { subject_id?: number | null; name?: string | null }) => {
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
};

/**
 * Elimina una grabación de la base de datos
 */
export const deleteAudioRecording = async (id: number) => {
  const response = await fetchWithFallback(`/audio-recordings/${id}`, { method: 'DELETE' });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo eliminar la grabación.');
  }
  return data;
};

/**
 * Crea o actualiza las URIs de transcripción y resumen de una grabación.
 * Usa upsert: si ya existe un registro para `recording_id`, lo actualiza.
 */
export const upsertAudioTranscript = async (payload: {
  recording_id: number;
  transcript_uri?: string | null;
  summary_uri?: string | null;
}) => {
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
};
