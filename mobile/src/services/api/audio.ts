import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { AudioRecording } from './types';
import { audioRepository, audioTranscriptRepository, syncService } from '../database';
import { getBackupPreferences } from '../backup/backupService';
import { assetSyncEngine } from '../sync/asset/AssetSyncEngine';

export const getAudioRecordings = async (): Promise<AudioRecording[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  // Retornar datos locales inmediatamente
  const localData = await audioRepository.getByUser(String(userId));

  if (!localData || localData.length === 0) {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return [];
      const response = await fetchWithFallback(`/audio-recordings/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const a of data) await audioRepository.upsertFromCloud(a);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // Sincronizar desde la nube en background solo si auto-upload activo (solo crea registros nuevos)
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return;
      const response = await fetchWithFallback(`/audio-recordings/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const a of data) await audioRepository.upsertFromCloud(a);
        }
      }
    } catch {}
  })();

  return localData;
};

export const createAudioRecording = async (payload: { subject_id?: string | null; name?: string; local_uri: string; duration?: number; id?: string }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  // 1. Guardar SIEMPRE en SQLite local primero — las grabaciones funcionan sin red
  const recording: any = { id, user_id: String(userId), ...payload };
  await audioRepository.create(recording);

  // Schedule file upload via asset pipeline (background, with retry + progress)
  assetSyncEngine.scheduleUpload('audio-recording', id, payload.local_uri, 'audio/m4a', `${id}.m4a`);

  // 2. Sincronizar SIEMPRE el registro de metadatos al servidor (necesario para que
  //    las transcripciones puedan referenciarlo mediante FK).
  //    El upload del archivo binario sigue siendo opcional (detrás del flag de backup).
  (async () => {
    try {
      const response = await fetchWithFallback('/audio-recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, id, user_id: Number(userId) }),
      });
      const data = await parseJsonSafely(response);
      if (response.ok && data) {
        await audioRepository.update(data.id, data);
      } else {
        throw new Error(data?.error || 'Error del servidor');
      }
    } catch {
      // Sin red: encolar para sincronizar cuando haya conexión
      await syncService.enqueueCreate('audio-recording', id, { ...payload, user_id: userId });
    }
  })();

  return recording;
};


export const updateAudioRecording = async (id: string, payload: { subject_id?: string | null; name?: string }): Promise<any> => {
  // 1. Actualizar localmente de forma inmediata
  await audioRepository.update(id, {
    ...payload,
    subject_id: payload.subject_id != null ? String(payload.subject_id) : undefined,
  });

  // 2. Sincronizar en background si auto-upload activo
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) {
        await syncService.enqueueUpdate('audio-recording', id, payload);
        return;
      }
      const response = await fetchWithFallback(`/audio-recordings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        await syncService.enqueueUpdate('audio-recording', id, payload);
      }
    } catch {
      await syncService.enqueueUpdate('audio-recording', id, payload);
    }
  })();

  return { ...payload };
};

export const deleteAudioRecording = async (id: string) => {
  // 1. Borrar localmente de forma inmediata
  await audioRepository.delete(id);

  // 2. Sincronizar la eliminación en background
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) {
        await syncService.enqueueDelete('audio-recording', id);
        return;
      }
      const response = await fetchWithFallback(`/audio-recordings/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        await syncService.enqueueDelete('audio-recording', id);
      }
    } catch {
      await syncService.enqueueDelete('audio-recording', id);
    }
  })();

  return { success: true };
};

export const upsertAudioTranscript = async (payload: { recording_id: string; transcript_uri?: string; transcript_text?: string; summary_uri?: string; summary_text?: string }) => {
  // Offline-First: Guardar localmente (inline + tabla dedicada)
  if (payload.transcript_text || payload.summary_text) {
    try {
      await audioRepository.update(payload.recording_id, {
        ...(payload.transcript_text ? { transcript_text: payload.transcript_text } : {}),
        ...(payload.summary_text ? { summary_text: payload.summary_text } : {})
      });
    } catch (e) {
      console.warn('[upsertAudioTranscript] No se pudo guardar transcript/summary en audio_recordings:', e);
    }

    try {
      const existing = await audioTranscriptRepository.getByRecording(payload.recording_id);
      const transcriptId = existing?.id || payload.recording_id;
      await audioTranscriptRepository.upsert({
        id: transcriptId,
        recording_id: payload.recording_id,
        ...(payload.transcript_uri ? { transcript_uri: payload.transcript_uri } : {}),
        ...(payload.transcript_text ? { transcript_text: payload.transcript_text } : {}),
        ...(payload.summary_uri ? { summary_uri: payload.summary_uri } : {}),
        ...(payload.summary_text ? { summary_text: payload.summary_text } : {}),
      });
    } catch (e) {
      console.warn('[upsertAudioTranscript] No se pudo guardar en audio_transcripts:', e);
    }
  }

  // Siempre enqueue un sync en lugar de intentar POST inline, para evitar 403
  // cuando la grabación padre aún no existe en el servidor (creada offline).
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();
  await syncService.enqueueCreate('audio-transcript', id, payload);
  return { id, ...payload, _isPending: true };
};
