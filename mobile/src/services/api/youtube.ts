/**
 * youtube.ts
 *
 * Servicio CRUD para videos de YouTube vinculados al usuario.
 * Los videos se enlazan (no se descargan) guardando solo la URL y metadatos.
 * Los subtítulos se obtienen desde el backend Python que envuelve la API de YouTube
 * (`youtube-transcript-api`), lo que es más rápido que transcribir el audio con Whisper.
 * Las transcripciones y resúmenes generados se persisten como archivos locales.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { YouTubeVideo } from './types';

/**
 * Obtiene todos los videos de YouTube del usuario
 */
export const getYouTubeVideos = async (): Promise<YouTubeVideo[]> => {
  const userId = await getUserId();
  if (!userId) return [];
  const response = await fetchWithFallback(`/youtube-videos/${userId}`);
  return (await parseJsonSafely(response)) || [];
};

/**
 * Crea un nuevo video de YouTube
 */
export const createYouTubeVideo = async (payload: {
  subject_id?: number | null;
  youtube_url: string;
  video_id?: string;
  title?: string | null;
  thumbnail_url?: string | null;
  duration?: number;
}) => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const payloadWithUser = { ...payload, user_id: Number(userId) };

  const response = await fetchWithFallback('/youtube-videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadWithUser),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo guardar el video en BD.');
  }

  return data;
};

/**
 * Actualiza un video de YouTube (ej: asociar materia, renombrar)
 */
export const updateYouTubeVideo = async (id: number, payload: { subject_id?: number | null; title?: string | null }) => {
  const response = await fetchWithFallback(`/youtube-videos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo actualizar el video.');
  }

  return data;
};

/**
 * Elimina un video de YouTube de la base de datos
 */
export const deleteYouTubeVideo = async (id: number) => {
  const response = await fetchWithFallback(`/youtube-videos/${id}`, { method: 'DELETE' });
  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo eliminar el video.');
  }
  return data;
};

/**
 * Crea o actualiza la transcripción de un video de YouTube.
 * Ahora soporta transcript_text inline (además de la URI de archivo local) para que
 * el asistente IA pueda leerlo directamente de la BD sin acceder al dispositivo.
 */
export const upsertYouTubeTranscript = async (payload: {
  video_id: number;
  transcript_uri?: string | null;
  /** Texto inline de la transcripción — leído directamente por buildContext */
  transcript_text?: string | null;
  summary_uri?: string | null;
}) => {
  const response = await fetchWithFallback('/youtube-transcripts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo guardar la transcripción del video.');
  }

  return data;
};

/**
 * Obtiene los subtítulos de un video de YouTube desde el backend.
 * @param videoId - ID de YouTube del video (ej. `dQw4w9WgXcQ`).
 * @param language - Código de idioma preferido (por defecto 'es').
 */
export const getYouTubeSubtitles = async (videoId: string, language: string = 'es'): Promise<{ captions: string; language: string }> => {
  const response = await fetchWithFallback('/youtube-captions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, language }),
  });

  const data = await parseJsonSafely(response);
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudieron obtener los subtítulos del video.');
  }

  return data;
};
