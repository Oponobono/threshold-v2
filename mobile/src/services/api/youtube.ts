import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { YouTubeVideo } from './types';
import { youTubeRepository, youTubeTranscriptRepository, syncService } from '../database';

export const getYouTubeVideos = async (): Promise<YouTubeVideo[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  // 1. Leer localmente primero
  const localData = await youTubeRepository.getByUser(String(userId));

  if (!localData || localData.length === 0) {
    try {
      const response = await fetchWithFallback(`/youtube-videos/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const v of data) await youTubeRepository.upsertFromCloud(v);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en background (solo crea registros nuevos, nunca sobreescribe)
  (async () => {
    try {
      const response = await fetchWithFallback(`/youtube-videos/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const v of data) await youTubeRepository.upsertFromCloud(v);
        }
      }
    } catch {}
  })();

  return localData;
};

export const createYouTubeVideo = async (payload: { subject_id?: string | null; youtube_url: string; video_id?: string; title?: string; thumbnail_url?: string; duration?: number; id?: string }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const video: any = { id, user_id: String(userId), ...payload };
  await youTubeRepository.create(video);

  try {
    const response = await fetchWithFallback('/youtube-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id, user_id: String(userId) }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await youTubeRepository.update(data.id, data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('youtube-video', id, { ...payload, user_id: userId });
    return video;
  }
};

export const updateYouTubeVideo = async (id: string, payload: { subject_id?: string | null; title?: string }): Promise<any> => {
  await youTubeRepository.update(id, {
    ...payload,
    subject_id: payload.subject_id != null ? String(payload.subject_id) : undefined,
  });

  try {
    const response = await fetchWithFallback(`/youtube-videos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(response);
    if (response.ok) return data;
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueUpdate('youtube-video', id, payload);
    return { ...payload, _isPending: true };
  }
};

export const deleteYouTubeVideo = async (id: string) => {
  await youTubeRepository.delete(id);

  try {
    const response = await fetchWithFallback(`/youtube-videos/${id}`, { method: 'DELETE' });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('youtube-video', id);
    return { success: true, _isPending: true };
  }
};

export const upsertYouTubeTranscript = async (payload: { video_id: string; transcript_uri?: string; transcript_text?: string; summary_uri?: string; summary_text?: string }) => {
  // Offline-First: Guardar localmente (inline + tabla dedicada)
  if (payload.transcript_text || payload.summary_text) {
    try {
      await youTubeRepository.update(payload.video_id, {
        ...(payload.transcript_text ? { transcript_text: payload.transcript_text } : {}),
        ...(payload.summary_text ? { summary_text: payload.summary_text } : {})
      });
    } catch (e) {
      console.warn('[upsertYouTubeTranscript] No se pudo guardar transcript/summary en youtube_videos:', e);
    }

    try {
      const existing = await youTubeTranscriptRepository.getByVideo(payload.video_id);
      const transcriptId = existing?.id || payload.video_id;
      await youTubeTranscriptRepository.upsert({
        id: transcriptId,
        video_id: payload.video_id,
        ...(payload.transcript_uri ? { transcript_uri: payload.transcript_uri } : {}),
        ...(payload.transcript_text ? { transcript_text: payload.transcript_text } : {}),
        ...(payload.summary_uri ? { summary_uri: payload.summary_uri } : {}),
        ...(payload.summary_text ? { summary_text: payload.summary_text } : {}),
      });
    } catch (e) {
      console.warn('[upsertYouTubeTranscript] No se pudo guardar en youtube_transcripts:', e);
    }
  }

  try {
    const response = await fetchWithFallback('/youtube-transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error del servidor');
    return data;
  } catch {
    const { uuidv4 } = await import('../../utils/uuid');
    const id = uuidv4();
    await syncService.enqueueCreate('youtube-transcript', id, payload);
    return { id, ...payload, _isPending: true };
  }
};

export const getYouTubeSubtitles = async (videoId: string, language: string = 'es') => {
  const response = await fetchWithFallback('/youtube-captions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, language }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'No se pudieron obtener los subtítulos');
  return data;
};
