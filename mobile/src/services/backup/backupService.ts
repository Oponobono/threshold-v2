/**
 * Backup Service
 * Gestiona el respaldo de archivos locales (fotos, grabaciones, documentos,
 * transcripciones) hacia Uploadthing a través del backend de Threshold.
 *
 * El almacenamiento primario siempre es el dispositivo.
 * Uploadthing es una copia de seguridad en la nube, opcional y controlada por el usuario.
 */
import { storageService } from '../storageService';
import { uploadFileToUploadthing } from '../uploadthing/storage';
import { fetchWithFallback, parseJsonSafely } from '../api/client';
import { getUserId } from '../api/auth/session';

// ─── Auto-subida individual ──────────────────────────────────────────────────

/**
 * Sube un archivo individual a Uploadthing de forma inmediata si el backup está habilitado.
 * Llama a esta función justo después de guardar un ítem (foto, audio, documento).
 *
 * @param localUri  - URI local del archivo
 * @param type      - Tipo: 'photo' | 'audio' | 'document' | 'transcript'
 * @param itemId    - ID del ítem en la BD (para marcar como respaldado)
 * @param filename  - Nombre del archivo
 * @param mimeType  - MIME type del archivo
 * @param transcriptType - 'audio' | 'youtube' (solo si type = 'transcript')
 */
export const autoUploadIfEnabled = async (
  localUri: string,
  type: 'photo' | 'audio' | 'document' | 'transcript',
  itemId: number,
  filename?: string,
  mimeType?: string,
  transcriptType?: 'audio' | 'youtube'
): Promise<string | null> => {
  const enabled = await storageService.getSecure(BACKUP_PREFS.ENABLED);
  if (enabled !== 'true') return null;

  try {
    console.log(`[BackupService] Auto-subida iniciada para ${type} ID: ${itemId} (${localUri})`);
    const result = await uploadFileToUploadthing(localUri, filename, mimeType);
    console.log(`[BackupService] ÉXITO: Archivo subido a la nube. URL: ${result.url}`);

    // Marcar como respaldado en el backend
    await fetchWithFallback('/backup/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        id: itemId,
        cloud_url: result.url,
        ...(transcriptType ? { transcript_type: transcriptType } : {}),
      }),
    });

    console.log(`[BackupService] ÉXITO: Registro marcado en BD como respaldado.`);
    return result.url;
  } catch (err) {
    // No propagamos el error — el archivo local ya fue guardado exitosamente
    console.error(`[BackupService] ERROR: Fallo al subir o marcar archivo en la nube:`, err);
    console.warn('[BackupService] Auto-subida fallida, se respaldará en el próximo backup manual.');
    return null;
  }
};


// ─── Claves de preferencia (SecureStore) ────────────────────────────────────

export const BACKUP_PREFS = {
  ENABLED: 'backup_enabled',
  AUTO_DOWNLOAD: 'backup_auto_download',
  INCLUDE_PHOTOS: 'backup_include_photos',
  INCLUDE_AUDIO: 'backup_include_audio',
  INCLUDE_DOCS: 'backup_include_docs',
  INCLUDE_TRANSCRIPTS: 'backup_include_transcripts',
  LAST_RUN: 'backup_last_run',
  LAST_DOWNLOAD: 'backup_last_download',
} as const;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface BackupPreferences {
  enabled: boolean;
  autoDownload: boolean;
  includePhotos: boolean;
  includeAudio: boolean;
  includeDocs: boolean;
  includeTranscripts: boolean;
  lastRun: string | null;
  lastDownload: string | null;
}

export interface BackupStats {
  photos: { total: number; backed: number };
  audio: { total: number; backed: number };
  docs: { total: number; backed: number };
  transcripts: { total: number; backed: number };
}

export interface BackupProgress {
  total: number;
  done: number;
  current: string;
  errors: number;
}

// ─── Leer / Escribir preferencias ───────────────────────────────────────────

export const getBackupPreferences = async (): Promise<BackupPreferences> => {
  const [enabled, autoDownload, photos, audio, docs, transcripts, lastRun, lastDownload] = await Promise.all([
    storageService.getSecure(BACKUP_PREFS.ENABLED),
    storageService.getSecure(BACKUP_PREFS.AUTO_DOWNLOAD),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_PHOTOS),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_AUDIO),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_DOCS),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_TRANSCRIPTS),
    storageService.getSecure(BACKUP_PREFS.LAST_RUN),
    storageService.getSecure(BACKUP_PREFS.LAST_DOWNLOAD),
  ]);

  return {
    enabled: enabled === 'true',
    autoDownload: autoDownload === 'true',
    includePhotos: photos !== 'false',
    includeAudio: audio !== 'false',
    includeDocs: docs !== 'false',
    includeTranscripts: transcripts !== 'false',
    lastRun: lastRun || null,
    lastDownload: lastDownload || null,
  };
};

export const saveBackupPreferences = async (prefs: Partial<BackupPreferences>): Promise<void> => {
  const promises: Promise<void>[] = [];
  if (prefs.enabled !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.ENABLED, String(prefs.enabled)));
  if (prefs.autoDownload !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.AUTO_DOWNLOAD, String(prefs.autoDownload)));
  if (prefs.includePhotos !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.INCLUDE_PHOTOS, String(prefs.includePhotos)));
  if (prefs.includeAudio !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.INCLUDE_AUDIO, String(prefs.includeAudio)));
  if (prefs.includeDocs !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.INCLUDE_DOCS, String(prefs.includeDocs)));
  if (prefs.includeTranscripts !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.INCLUDE_TRANSCRIPTS, String(prefs.includeTranscripts)));
  await Promise.all(promises);
};

// ─── Obtener estadísticas de backup ─────────────────────────────────────────

export const getBackupStats = async (): Promise<BackupStats> => {
  const userId = await getUserId();
  if (!userId) return { photos: { total: 0, backed: 0 }, audio: { total: 0, backed: 0 }, docs: { total: 0, backed: 0 }, transcripts: { total: 0, backed: 0 } };

  try {
    const response = await fetchWithFallback(`/backup/stats`);
    if (!response.ok) throw new Error('stats fetch failed');
    return await parseJsonSafely(response);
  } catch {
    return { photos: { total: 0, backed: 0 }, audio: { total: 0, backed: 0 }, docs: { total: 0, backed: 0 }, transcripts: { total: 0, backed: 0 } };
  }
};

// ─── Ejecución del backup ────────────────────────────────────────────────────

/**
 * Ejecuta el proceso de backup.
 * Sube a Uploadthing todos los ítems no respaldados según las preferencias.
 * @param onProgress - Callback con el progreso actual (llamado en cada ítem)
 */
export const runBackup = async (
  onProgress?: (progress: BackupProgress) => void
): Promise<{ success: boolean; uploaded: number; errors: number }> => {
  const userId = await getUserId();
  if (!userId) return { success: false, uploaded: 0, errors: 0 };

  const prefs = await getBackupPreferences();
  if (!prefs.enabled) return { success: false, uploaded: 0, errors: 0 };

  let uploaded = 0;
  let errors = 0;

  // Obtener ítems pendientes de backup desde el backend
  const response = await fetchWithFallback(`/backup/pending`);
  if (!response.ok) return { success: false, uploaded: 0, errors: 0 };

  const pending = await parseJsonSafely(response) as {
    photos: { id: number; uri: string }[];
    audio: { id: number; local_uri: string; name: string }[];
    docs: { id: number; local_uri: string; name: string }[];
    transcripts: { id: number; type: 'audio' | 'youtube'; text: string; recording_id?: number; video_id?: number }[];
  };

  const tasks: (() => Promise<void>)[] = [];

  // ── Fotos ──
  if (prefs.includePhotos) {
    for (const photo of (pending.photos || [])) {
      tasks.push(async () => {
          console.log(`[BackupService] Iniciando backup manual de foto ID: ${photo.id}`);
          const result = await uploadFileToUploadthing(photo.uri, `photo_${photo.id}.jpg`, 'image/jpeg');
          console.log(`[BackupService] ÉXITO: Foto subida. URL: ${result.url}`);
          await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'photo', id: photo.id, cloud_url: result.url }),
          });
          console.log(`[BackupService] ÉXITO: Foto ${photo.id} marcada como respaldada.`);
          uploaded++;
        } catch (err) {
          console.error(`[BackupService] ERROR: Falló el backup de foto ${photo.id}:`, err);
          errors++;
        }
      });
    }
  }

  // ── Audio ──
  if (prefs.includeAudio) {
    for (const rec of (pending.audio || [])) {
      tasks.push(async () => {
        try {
          const ext = rec.local_uri.split('.').pop() || 'm4a';
          const result = await uploadFileToUploadthing(rec.local_uri, `audio_${rec.id}.${ext}`, 'audio/mp4');
          await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'audio', id: rec.id, cloud_url: result.url }),
          });
          uploaded++;
        } catch { errors++; }
      });
    }
  }

  // ── Documentos ──
  if (prefs.includeDocs) {
    for (const doc of (pending.docs || [])) {
      tasks.push(async () => {
        try {
          const ext = doc.local_uri.split('.').pop() || 'pdf';
          const mime = ext === 'pdf' ? 'application/pdf' : 'text/plain';
          const result = await uploadFileToUploadthing(doc.local_uri, `doc_${doc.id}.${ext}`, mime);
          await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'document', id: doc.id, cloud_url: result.url }),
          });
          uploaded++;
        } catch { errors++; }
      });
    }
  }

  // ── Transcripciones (subir como .txt) ──
  if (prefs.includeTranscripts) {
    for (const t of (pending.transcripts || [])) {
      tasks.push(async () => {
        try {
          // Crear Blob de texto para subirlo como archivo
          const blob = new Blob([t.text], { type: 'text/plain' });
          const tempUri = URL.createObjectURL(blob);
          const result = await uploadFileToUploadthing(tempUri, `transcript_${t.type}_${t.id}.txt`, 'text/plain');
          URL.revokeObjectURL(tempUri);
          await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'transcript', id: t.id, transcript_type: t.type, cloud_url: result.url }),
          });
          uploaded++;
        } catch { errors++; }
      });
    }
  }

  // Ejecutar todas las tareas secuencialmente con progreso
  const total = tasks.length;
  let done = 0;

  for (const task of tasks) {
    await task();
    done++;
    onProgress?.({ total, done, current: `${done}/${total}`, errors });
  }

  // Guardar fecha del último backup
  await storageService.saveSecure(BACKUP_PREFS.LAST_RUN, new Date().toISOString());

  return { success: errors === 0, uploaded, errors };
};
