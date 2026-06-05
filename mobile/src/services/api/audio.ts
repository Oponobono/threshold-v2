import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { AudioRecording } from './types';
import { audioRepository, syncService } from '../database';
import { getBackupPreferences } from '../backup/backupService';

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
          for (const a of data) await audioRepository.upsert(a);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // Sincronizar desde la nube en background solo si auto-upload activo
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return;
      const response = await fetchWithFallback(`/audio-recordings/${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const a of data) await audioRepository.upsert(a);
        }
      }
    } catch {}
  })();

  return localData;
};

export const createAudioRecording = async (payload: { subject_id?: number | null; name?: string; local_uri: string; duration?: number; id?: string }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  // 1. Guardar SIEMPRE en SQLite local primero — las grabaciones funcionan sin red
  const recording: any = { id, user_id: String(userId), ...payload };
  await audioRepository.create(recording);

  // 2. Sincronizar con la nube SOLO si el usuario habilitó auto-upload (background, no bloqueante)
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload || !prefs?.includeAudio) return;

      const response = await fetchWithFallback('/audio-recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, id, user_id: Number(userId) }),
      });
      const data = await parseJsonSafely(response);
      if (response.ok && data) {
        await audioRepository.upsert(data);
      } else {
        throw new Error(data?.error || 'Error del servidor');
      }
    } catch {
      // Auto-upload desactivado o falló: encolar para backup manual
      await syncService.enqueueCreate('audio-recording', id, { ...payload, user_id: userId });
    }
  })();

  return recording;
};

export const updateAudioRecording = async (id: string, payload: { subject_id?: number | null; name?: string }): Promise<any> => {
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

export const upsertAudioTranscript = async (payload: { recording_id: string; transcript_uri?: string; transcript_text?: string; summary_uri?: string }) => {
  try {
    const response = await fetchWithFallback('/audio-transcripts', {
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
    await syncService.enqueueCreate('audio-transcript', id, payload);
    return { id, ...payload, _isPending: true };
  }
};
