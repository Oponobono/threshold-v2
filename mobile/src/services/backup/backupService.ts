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
import * as FileSystem from 'expo-file-system/legacy';
import { databaseService } from '../database/DatabaseService';

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
  const [enabled, autoUpload] = await Promise.all([
    storageService.getSecure(BACKUP_PREFS.ENABLED),
    storageService.getSecure(BACKUP_PREFS.AUTO_UPLOAD),
  ]);
  
  if (enabled !== 'true' || autoUpload !== 'true') return null;

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
  AUTO_UPLOAD: 'backup_auto_upload',
  AUTO_DOWNLOAD: 'backup_auto_download',
  INCLUDE_PHOTOS: 'backup_include_photos',
  INCLUDE_AUDIO: 'backup_include_audio',
  INCLUDE_DOCS: 'backup_include_docs',
  INCLUDE_TRANSCRIPTS: 'backup_include_transcripts',
  LAST_RUN: 'backup_last_run',
  LAST_DOWNLOAD: 'backup_last_download',
  // Backup programado
  SCHEDULED_ENABLED: 'backup_scheduled_enabled',
  SCHEDULED_HOUR: 'backup_scheduled_hour',
  SCHEDULED_MINUTE: 'backup_scheduled_minute',
  SCHEDULED_TYPE: 'backup_scheduled_type',
} as const;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ScheduledBackupType = 'datos' | 'multimedia' | 'ambos';

export interface ScheduledBackupConfig {
  enabled: boolean;
  hour: number;   // 0-23
  minute: number; // 0-59
  type: ScheduledBackupType;
}

export interface BackupPreferences {
  enabled: boolean;
  autoUpload: boolean;
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
  const [enabled, autoUpload, autoDownload, photos, audio, docs, transcripts, lastRun, lastDownload] = await Promise.all([
    storageService.getSecure(BACKUP_PREFS.ENABLED),
    storageService.getSecure(BACKUP_PREFS.AUTO_UPLOAD),
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
    autoUpload: autoUpload === 'true',
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
  if (prefs.autoUpload !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.AUTO_UPLOAD, String(prefs.autoUpload)));
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

// ─── Configuración de backup programado ─────────────────────────────────────

export const getScheduledBackupConfig = async (): Promise<ScheduledBackupConfig> => {
  const [enabled, hour, minute, type] = await Promise.all([
    storageService.getSecure(BACKUP_PREFS.SCHEDULED_ENABLED),
    storageService.getSecure(BACKUP_PREFS.SCHEDULED_HOUR),
    storageService.getSecure(BACKUP_PREFS.SCHEDULED_MINUTE),
    storageService.getSecure(BACKUP_PREFS.SCHEDULED_TYPE),
  ]);
  return {
    enabled: enabled === 'true',
    hour: hour !== null ? parseInt(hour, 10) : 2,
    minute: minute !== null ? parseInt(minute, 10) : 0,
    type: (type as ScheduledBackupType) || 'ambos',
  };
};

export const saveScheduledBackupConfig = async (config: Partial<ScheduledBackupConfig>): Promise<void> => {
  const promises: Promise<void>[] = [];
  if (config.enabled !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.SCHEDULED_ENABLED, String(config.enabled)));
  if (config.hour !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.SCHEDULED_HOUR, String(config.hour)));
  if (config.minute !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.SCHEDULED_MINUTE, String(config.minute)));
  if (config.type !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.SCHEDULED_TYPE, config.type));
  await Promise.all(promises);
};

// ─── Obtener estadísticas de backup ─────────────────────────────────────────

export const getBackupStats = async (): Promise<BackupStats> => {
  try {
    const response = await fetchWithFallback(`/backup/stats`);
    if (!response.ok) throw new Error('stats fetch failed');
    const serverStats = await parseJsonSafely(response) as BackupStats;
    if (serverStats && (serverStats.photos.total > 0 || serverStats.audio.total > 0 || serverStats.docs.total > 0 || serverStats.transcripts.total > 0)) {
      return serverStats;
    }
  } catch {}

  return getLocalBackupStats();
};

async function getLocalBackupStats(): Promise<BackupStats> {
  try {
    const db = databaseService.getDb();

    const [photoRow, audioRow, docRow, audioTransRow, ytTransRow] = await Promise.all([
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM photos`),
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM audio_recordings`),
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM scanned_documents`),
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM audio_recordings WHERE transcript_text IS NOT NULL AND transcript_text != ''`),
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN cloud_url IS NOT NULL AND cloud_url != '' THEN 1 ELSE 0 END) as backed FROM youtube_videos WHERE transcript_text IS NOT NULL AND transcript_text != ''`),
    ]);

    const transcriptTotal = (audioTransRow?.total ?? 0) + (ytTransRow?.total ?? 0);
    const transcriptBacked = (audioTransRow?.backed ?? 0) + (ytTransRow?.backed ?? 0);

    return {
      photos: { total: photoRow?.total ?? 0, backed: photoRow?.backed ?? 0 },
      audio: { total: audioRow?.total ?? 0, backed: audioRow?.backed ?? 0 },
      docs: { total: docRow?.total ?? 0, backed: docRow?.backed ?? 0 },
      transcripts: { total: transcriptTotal, backed: transcriptBacked },
    };
  } catch {
    return { photos: { total: 0, backed: 0 }, audio: { total: 0, backed: 0 }, docs: { total: 0, backed: 0 }, transcripts: { total: 0, backed: 0 } };
  }
}

// ─── Ejecución del backup ────────────────────────────────────────────────────

/**
 * Ejecuta el proceso de backup.
 * Sube a Uploadthing todos los ítems no respaldados según las preferencias.
 * @param onProgress - Callback con el progreso actual (llamado en cada ítem)
 */
export const runBackup = async (
  onProgress?: (progress: BackupProgress) => void,
  overridePrefs?: Partial<BackupPreferences>
): Promise<{ success: boolean; uploaded: number; errors: number }> => {
  const userId = await getUserId();
  if (!userId) return { success: false, uploaded: 0, errors: 0 };

  let prefs = await getBackupPreferences();
  if (overridePrefs) {
    prefs = { ...prefs, ...overridePrefs };
  }
  if (!prefs.enabled) return { success: false, uploaded: 0, errors: 0 };

  let uploaded = 0;
  let errors = 0;

  // ──────────────────────────────────────────────────────────────────
  // FASE 0: Sincronizar metadatos locales al backend
  // Los ítems creados offline (sin auto-upload) solo existen en SQLite local.
  // Necesitamos registrarlos en el backend ANTES de pedir los pendientes,
  // porque el backend no sabe que existen.
  // ──────────────────────────────────────────────────────────────────
  const db = databaseService.getDb();

  // ── Fase 0a: Fotos locales sin registro en backend ──
  if (prefs.includePhotos) {
    try {
      const localOnlyPhotos: any[] = await db.getAllAsync(
        `SELECT id, subject_id, local_uri, es_favorita, ocr_text, group_id
         FROM photos
         WHERE (cloud_url IS NULL OR cloud_url = '') AND (is_backed_up IS NULL OR is_backed_up = 0)`
      );
      console.log(`[BackupService] Fase 0a: ${localOnlyPhotos.length} foto(s) sin registro en backend.`);
      for (const photo of localOnlyPhotos) {
        try {
          await fetchWithFallback('/photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: photo.id, subject_id: photo.subject_id, local_uri: photo.local_uri, es_favorita: photo.es_favorita, ocr_text: photo.ocr_text, group_id: photo.group_id, userId }),
          });
        } catch (e) {
          console.warn(`[BackupService] Fase 0a ⚠️: foto ${photo.id}:`, e);
        }
      }
    } catch (e) {
      console.warn('[BackupService] Fase 0a: Error leyendo fotos locales:', e);
    }
  }

  // ── Fase 0b: Grabaciones de audio locales sin registro en backend ──
  if (prefs.includeAudio) {
    try {
      const localOnlyAudio: any[] = await db.getAllAsync(
        `SELECT id, user_id, subject_id, name, local_uri, duration
         FROM audio_recordings
         WHERE (cloud_url IS NULL OR cloud_url = '') AND (is_backed_up IS NULL OR is_backed_up = 0)`
      );
      console.log(`[BackupService] Fase 0b: ${localOnlyAudio.length} grabación(es) sin registro en backend.`);
      for (const rec of localOnlyAudio) {
        try {
          await fetchWithFallback('/audio-recordings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: rec.id, user_id: Number(rec.user_id || userId), subject_id: rec.subject_id, name: rec.name, local_uri: rec.local_uri, duration: rec.duration }),
          });
        } catch (e) {
          console.warn(`[BackupService] Fase 0b ⚠️: grabación ${rec.id}:`, e);
        }
      }
    } catch (e) {
      console.warn('[BackupService] Fase 0b: Error leyendo grabaciones locales:', e);
    }
  }

  // ── Fase 0c: Documentos escaneados locales sin registro en backend ──
  if (prefs.includeDocs) {
    try {
      const localOnlyDocs: any[] = await db.getAllAsync(
        `SELECT id, user_id, subject_id, name, local_uri, ocr_text
         FROM scanned_documents
         WHERE (cloud_url IS NULL OR cloud_url = '') AND (is_backed_up IS NULL OR is_backed_up = 0)`
      );
      console.log(`[BackupService] Fase 0c: ${localOnlyDocs.length} documento(s) sin registro en backend.`);
      for (const doc of localOnlyDocs) {
        try {
          await fetchWithFallback('/scanned_documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: doc.id, user_id: doc.user_id || userId, subject_id: doc.subject_id, name: doc.name, local_uri: doc.local_uri, ocr_text: doc.ocr_text }),
          });
        } catch (e) {
          console.warn(`[BackupService] Fase 0c ⚠️: documento ${doc.id}:`, e);
        }
      }
    } catch (e) {
      console.warn('[BackupService] Fase 0c: Error leyendo documentos locales:', e);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // FASE 1: Obtener ítems pendientes de backup desde el backend y subirlos
  // ──────────────────────────────────────────────────────────────────
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
        try {
          console.log(`[BackupService] Iniciando backup manual de foto ID: ${photo.id}`);
          const fileInfo = await FileSystem.getInfoAsync(photo.uri);
          if (!fileInfo.exists) {
            console.warn(`[BackupService] Archivo fantasma detectado (foto ${photo.id}). Marcando para omitir futuros intentos.`);
            const res = await fetchWithFallback(`/backup/mark`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'photo', id: photo.id, cloud_url: 'ghost_file' }),
            });
            if (!res.ok) throw new Error(`Marcar fantasma falló: ${res.status}`);
            uploaded++;
            return;
          }

          const result = await uploadFileToUploadthing(photo.uri, `photo_${photo.id}.jpg`, 'image/jpeg');
          console.log(`[BackupService] ÉXITO: Foto subida. URL: ${result.url}`);
          const res2 = await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'photo', id: photo.id, cloud_url: result.url }),
          });
          if (!res2.ok) throw new Error(`Marcar foto falló: ${res2.status}`);
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
          console.log(`[BackupService] Iniciando backup manual de audio ID: ${rec.id}`);
          const fileInfo = await FileSystem.getInfoAsync(rec.local_uri);
          if (!fileInfo.exists) {
            console.warn(`[BackupService] Archivo fantasma detectado (audio ${rec.id}). Marcando para omitir futuros intentos.`);
            const res = await fetchWithFallback(`/backup/mark`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'audio', id: rec.id, cloud_url: 'ghost_file' }),
            });
            if (!res.ok) throw new Error(`Marcar fantasma falló: ${res.status}`);
            uploaded++;
            return;
          }

          const ext = rec.local_uri.split('.').pop() || 'm4a';
          const result = await uploadFileToUploadthing(rec.local_uri, `audio_${rec.id}.${ext}`, 'audio/mp4');
          const res2 = await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'audio', id: rec.id, cloud_url: result.url }),
          });
          if (!res2.ok) throw new Error(`Marcar audio falló: ${res2.status}`);
          console.log(`[BackupService] ÉXITO: Audio ${rec.id} respaldado.`);
          uploaded++;
        } catch (err) { 
          console.error(`[BackupService] ERROR: Falló el backup de audio ${rec.id}:`, err);
          errors++; 
        }
      });
    }
  }

  // ── Documentos ──
  if (prefs.includeDocs) {
    for (const doc of (pending.docs || [])) {
      tasks.push(async () => {
        try {
          console.log(`[BackupService] Iniciando backup manual de documento ID: ${doc.id}`);
          const fileInfo = await FileSystem.getInfoAsync(doc.local_uri);
          if (!fileInfo.exists) {
            console.warn(`[BackupService] Archivo fantasma detectado (documento ${doc.id}). Marcando para omitir futuros intentos.`);
            const res = await fetchWithFallback(`/backup/mark`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'document', id: doc.id, cloud_url: 'ghost_file' }),
            });
            if (!res.ok) throw new Error(`Marcar fantasma falló: ${res.status}`);
            uploaded++;
            return;
          }

          const ext = doc.local_uri.split('.').pop() || 'pdf';
          const mime = ext === 'pdf' ? 'application/pdf' : 'text/plain';
          const result = await uploadFileToUploadthing(doc.local_uri, `doc_${doc.id}.${ext}`, mime);
          const res2 = await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'document', id: doc.id, cloud_url: result.url }),
          });
          if (!res2.ok) throw new Error(`Marcar documento falló: ${res2.status}`);
          console.log(`[BackupService] ÉXITO: Documento ${doc.id} respaldado.`);
          uploaded++;
        } catch (err) { 
          console.error(`[BackupService] ERROR: Falló el backup de documento ${doc.id}:`, err);
          errors++; 
        }
      });
    }
  }

  // ── Transcripciones (subir como .txt) ──
  if (prefs.includeTranscripts) {
    for (const t of (pending.transcripts || [])) {
      tasks.push(async () => {
        try {
          console.log(`[BackupService] Iniciando backup manual de transcripción ID: ${t.id}`);
          // Escribir el texto a un archivo temporal en lugar de usar Blob (React Native no soporta createObjectURL)
          const tempUri = `${FileSystem.cacheDirectory}transcript_${t.type}_${t.id}.txt`;
          await FileSystem.writeAsStringAsync(tempUri, t.text || 'Sin contenido', { encoding: FileSystem.EncodingType.UTF8 });
          
          const result = await uploadFileToUploadthing(tempUri, `transcript_${t.type}_${t.id}.txt`, 'text/plain');
          
          // Limpiar archivo temporal
          await FileSystem.deleteAsync(tempUri, { idempotent: true });

          const res = await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'transcript', id: t.id, transcript_type: t.type, cloud_url: result.url }),
          });
          if (!res.ok) throw new Error(`Marcar transcripción falló: ${res.status}`);
          console.log(`[BackupService] ÉXITO: Transcripción ${t.id} respaldada.`);
          uploaded++;
        } catch (err) { 
          console.error(`[BackupService] ERROR: Falló el backup de transcripción ${t.id}:`, err);
          errors++; 
        }
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
