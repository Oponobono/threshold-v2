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
import { fetchWithFallback } from '../api/client';
import { getUserId } from '../api/auth/session';
import * as FileSystem from 'expo-file-system/legacy';
import { databaseService } from '../database/DatabaseService';
import { useConnectivityStore } from '../../store/useConnectivityStore';

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
  SCHEDULED_LAST_RUN: 'backup_scheduled_last_run', // Última vez que se ejecutó automáticamente
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
  try {
    const [enabled, hour, minute, type] = await Promise.all([
      storageService.getSecure(BACKUP_PREFS.SCHEDULED_ENABLED),
      storageService.getSecure(BACKUP_PREFS.SCHEDULED_HOUR),
      storageService.getSecure(BACKUP_PREFS.SCHEDULED_MINUTE),
      storageService.getSecure(BACKUP_PREFS.SCHEDULED_TYPE),
    ]);
    
    const config: ScheduledBackupConfig = {
      enabled: enabled === 'true',
      hour: hour !== null ? parseInt(hour, 10) : 2,
      minute: minute !== null ? parseInt(minute, 10) : 0,
      type: (type as ScheduledBackupType) || 'ambos',
    };
    
    console.log(`[BackupService] getScheduledBackupConfig: enabled=${config.enabled}, hora=${config.hour}:${String(config.minute).padStart(2, '0')}`);
    return config;
  } catch (err) {
    console.error('[BackupService] Error leyendo config de backup programado:', err);
    // Retornar default pero con enabled=false para ser seguro
    return {
      enabled: false,
      hour: 2,
      minute: 0,
      type: 'ambos',
    };
  }
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

/**
 * Obtiene la fecha/hora de la última ejecución automática del backup programado.
 * Retorna null si nunca se ha ejecutado automáticamente.
 */
export const getScheduledBackupLastRun = async (): Promise<Date | null> => {
  try {
    const lastRunStr = await storageService.getSecure(BACKUP_PREFS.SCHEDULED_LAST_RUN);
    if (!lastRunStr) return null;
    return new Date(lastRunStr);
  } catch (err) {
    console.warn('[BackupService] Error obteniendo última ejecución automática:', err);
    return null;
  }
};

// ─── Obtener estadísticas de backup ─────────────────────────────────────────

export const getBackupStats = async (): Promise<BackupStats> => {
  return getLocalBackupStats();
};

async function getLocalBackupStats(): Promise<BackupStats> {
  try {
    const db = databaseService.getDb();

    const [photoRow, audioRow, docRow, audioTransRow, ytTransRow] = await Promise.all([
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM photos`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM audio_recordings`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM scanned_documents`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM audio_recordings WHERE transcript_text IS NOT NULL AND transcript_text != ''`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, 0 as backed FROM youtube_videos WHERE transcript_text IS NOT NULL AND transcript_text != ''`) as Promise<{ total: number; backed: number } | undefined>,
    ]);

    const photoTotal = (photoRow as { total: number; backed: number | null } | undefined)?.total ?? 0;
    const photoBacked = (photoRow as { total: number; backed: number | null } | undefined)?.backed ?? 0;
    const audioTotal = (audioRow as { total: number; backed: number | null } | undefined)?.total ?? 0;
    const audioBacked = (audioRow as { total: number; backed: number | null } | undefined)?.backed ?? 0;
    const docTotal = (docRow as { total: number; backed: number | null } | undefined)?.total ?? 0;
    const docBacked = (docRow as { total: number; backed: number | null } | undefined)?.backed ?? 0;
    
    const transcriptTotal = ((audioTransRow as { total: number; backed: number | null } | undefined)?.total ?? 0) + ((ytTransRow as { total: number; backed: number } | undefined)?.total ?? 0);
    const transcriptBacked = ((audioTransRow as { total: number; backed: number | null } | undefined)?.backed ?? 0) + ((ytTransRow as { total: number; backed: number } | undefined)?.backed ?? 0);

    return {
      photos: { total: photoTotal, backed: photoBacked },
      audio: { total: audioTotal, backed: audioBacked },
      docs: { total: docTotal, backed: docBacked },
      transcripts: { total: transcriptTotal, backed: transcriptBacked },
    };
  } catch (err) {
    console.error('[BackupService] Error obteniendo estadísticas locales:', err);
    return { photos: { total: 0, backed: 0 }, audio: { total: 0, backed: 0 }, docs: { total: 0, backed: 0 }, transcripts: { total: 0, backed: 0 } };
  }
}

/**
 * Obtiene items NO respaldados directamente desde SQLite local.
 * Fuente de verdad para el proceso de backup (is_backed_up = 0).
 */
async function getPendingItemsFromLocalDB(prefs: BackupPreferences): Promise<{
  photos: { id: string; uri: string }[];
  audio: { id: string; local_uri: string; name: string }[];
  docs: { id: string; local_uri: string }[];
  transcripts: { id: string; type: 'audio' | 'youtube'; text: string; recording_id?: string; video_id?: string }[];
}> {
  const db = databaseService.getDb();
  const result = {
    photos: [] as { id: string; uri: string }[],
    audio: [] as { id: string; local_uri: string; name: string }[],
    docs: [] as { id: string; local_uri: string }[],
    transcripts: [] as { id: string; type: 'audio' | 'youtube'; text: string; recording_id?: string; video_id?: string }[],
  };

  try {
    // Fotos no respaldadas
    if (prefs.includePhotos) {
      const photos = await db.getAllAsync(
        `SELECT id, local_uri FROM photos WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND local_uri IS NOT NULL AND local_uri != ''`
      );
      result.photos = photos.map((p: any) => ({ id: String(p.id), uri: p.local_uri }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.photos.length} foto(s) pendientes`);
    }

    // Grabaciones de audio no respaldadas
    if (prefs.includeAudio) {
      const audio = await db.getAllAsync(
        `SELECT id, local_uri, name FROM audio_recordings WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND local_uri IS NOT NULL AND local_uri != ''`
      );
      result.audio = audio.map((a: any) => ({ id: String(a.id), local_uri: a.local_uri, name: a.name }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.audio.length} grabación(es) pendiente(s)`);
    }

    // Documentos no respaldados
    if (prefs.includeDocs) {
      const docs = await db.getAllAsync(
        `SELECT id, local_uri FROM scanned_documents WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND local_uri IS NOT NULL AND local_uri != ''`
      );
      result.docs = docs.map((d: any) => ({ id: String(d.id), local_uri: d.local_uri }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.docs.length} documento(s) pendiente(s)`);
    }

    // Transcripciones no respaldadas
    if (prefs.includeTranscripts) {
      // Audio transcripts (transcript_text está en la misma fila de audio_recordings)
      const audioTranscripts = await db.getAllAsync(
        `SELECT id, transcript_text, id as recording_id FROM audio_recordings WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND transcript_text IS NOT NULL AND transcript_text != ''`
      );
      result.transcripts.push(...audioTranscripts.map((t: any) => ({ id: String(t.id), type: 'audio' as const, text: t.transcript_text, recording_id: String(t.recording_id) })));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${audioTranscripts.length} transcripción(es) de audio pendiente(s)`);

      // YouTube transcripts (la tabla no tiene columna is_backed_up, se filtra por NULL)
      const ytTranscripts = await db.getAllAsync(
        `SELECT id, transcript_text, id as video_id FROM youtube_videos WHERE transcript_text IS NOT NULL AND transcript_text != ''`
      );
      result.transcripts.push(...ytTranscripts.map((t: any) => ({ id: String(t.id), type: 'youtube' as const, text: t.transcript_text, video_id: String(t.video_id) })));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${ytTranscripts.length} transcripción(es) de YouTube pendiente(s)`);
    }
  } catch (err) {
    console.error('[BackupService] Error obteniendo items pendientes desde DB local:', err);
  }

  return result;
}

// ─── Rescatar estado atascado ───────────────────────────────────────────────

/**
 * Resetea a 0 la bandera `is_backed_up` de todos los items marcados como respaldados
 * pero que NO tienen una URL real de Uploadthing (cloud_url NULL, vacío o 'ghost_file').
 * Útil si un backup previo dejó el flag en 1 sin haber subido realmente el archivo.
 * 
 * @returns Objeto con la cantidad de items reseteados por categoría
 */
export const resetStuckBackupFlags = async (): Promise<{
  photos: number;
  audio: number;
  docs: number;
  audioTranscripts: number;
  ytTranscripts: number;
}> => {
  const db = databaseService.getDb();
  const result = { photos: 0, audio: 0, docs: 0, audioTranscripts: 0, ytTranscripts: 0 };

  try {
    const { changes: photoChanges } = await db.runAsync(
      `UPDATE photos SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.photos = photoChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en photos:', e);
  }

  try {
    const { changes: audioChanges } = await db.runAsync(
      `UPDATE audio_recordings SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.audio = audioChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en audio:', e);
  }

  try {
    const { changes: docChanges } = await db.runAsync(
      `UPDATE scanned_documents SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.docs = docChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en documentos:', e);
  }

  try {
    const { changes: audioTransChanges } = await db.runAsync(
      `UPDATE audio_recordings SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.audioTranscripts = audioTransChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en transcripciones de audio:', e);
  }

  try {
    const { changes: ytTransChanges } = await db.runAsync(
      `UPDATE youtube_videos SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.ytTranscripts = ytTransChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en transcripciones de YouTube:', e);
  }

  console.log('[BackupService] resetStuckBackupFlags completado:', result);
  return result;
};

// ─── Ejecución del backup ────────────────────────────────────────────────────

/**
 * Ejecuta el proceso de backup.
 * Sube a Uploadthing todos los ítems no respaldados (is_backed_up = 0) según las preferencias.
 * Siempre usa SQLite local como fuente de verdad para determinar items pendientes.
 * Marca tanto backend como BD local después de cada subida exitosa.
 * 
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

  // Detectar si estamos en modo offline
  const isOffline = !useConnectivityStore.getState().isOnline;
  console.log(`[BackupService] Iniciando backup. Modo offline: ${isOffline}`);

  const db = databaseService.getDb();

  // ──────────────────────────────────────────────────────────────────
  // FASE 0: Sincronizar metadatos locales al backend (SOLO EN MODO ONLINE)
  // Los ítems creados offline (sin auto-upload) solo existen en SQLite local.
  // En modo online, registrarlos en el backend ANTES de pedir los pendientes.
  // ──────────────────────────────────────────────────────────────────
  if (!isOffline) {
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
          `SELECT id, user_id, subject_id, local_uri, ocr_text
           FROM scanned_documents
           WHERE (cloud_url IS NULL OR cloud_url = '') AND (is_backed_up IS NULL OR is_backed_up = 0)`
        );
        console.log(`[BackupService] Fase 0c: ${localOnlyDocs.length} documento(s) sin registro en backend.`);
        for (const doc of localOnlyDocs) {
          try {
            await fetchWithFallback('/scanned_documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: doc.id, user_id: doc.user_id || userId, subject_id: doc.subject_id, local_uri: doc.local_uri, ocr_text: doc.ocr_text }),
            });
          } catch (e) {
            console.warn(`[BackupService] Fase 0c ⚠️: documento ${doc.id}:`, e);
          }
        }
      } catch (e) {
        console.warn('[BackupService] Fase 0c: Error leyendo documentos locales:', e);
      }
    }
  } // Cierre de if (!isOffline)

  // ──────────────────────────────────────────────────────────────────
  // FASE 1: Obtener ítems pendientes desde SQLite local y subirlos
  // Siempre usa la BD local como fuente de verdad (is_backed_up = 0).
  // ──────────────────────────────────────────────────────────────────
  const pending = await getPendingItemsFromLocalDB(prefs);
  console.log(`[BackupService] Fase 1: ${pending.photos.length + pending.audio.length + pending.docs.length + pending.transcripts.length} item(s) pendientes desde BD local`);

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
            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              console.warn(`[BackupService] ⚠️ Backend no pudo marcar fantasma foto ${photo.id}: ${res.status} — ${errBody}. Marcando localmente.`);
            }
            try {
              await db.runAsync(
                `UPDATE photos SET is_backed_up = 1, cloud_url = 'ghost_file' WHERE id = ?`,
                [Number(photo.id)]
              );
            } catch (e) {
              console.warn(`[BackupService] No se pudo marcar fantasma local foto ${photo.id}:`, e);
            }
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
          if (!res2.ok) {
            const errBody = await res2.text().catch(() => '');
            console.warn(`[BackupService] ⚠️ Backend no pudo marcar foto ${photo.id}: ${res2.status} — ${errBody}. Marcando localmente.`);
          }
          try {
            await db.runAsync(
              `UPDATE photos SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
              [result.url, Number(photo.id)]
            );
          } catch (e) {
            console.warn(`[BackupService] No se pudo actualizar estado local de foto ${photo.id}:`, e);
          }
          console.log(`[BackupService] ÉXITO: Foto ${photo.id} respaldada.`);
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
            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              console.warn(`[BackupService] ⚠️ Backend no pudo marcar fantasma audio ${rec.id}: ${res.status} — ${errBody}. Marcando localmente.`);
            }
            try {
              await db.runAsync(
                `UPDATE audio_recordings SET is_backed_up = 1, cloud_url = 'ghost_file' WHERE id = ?`,
                [Number(rec.id)]
              );
            } catch (e) {
              console.warn(`[BackupService] No se pudo marcar fantasma local audio ${rec.id}:`, e);
            }
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
          if (!res2.ok) {
            const errBody = await res2.text().catch(() => '');
            console.warn(`[BackupService] ⚠️ Backend no pudo marcar audio ${rec.id}: ${res2.status} — ${errBody}. Marcando localmente.`);
          }
          try {
            await db.runAsync(
              `UPDATE audio_recordings SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
              [result.url, Number(rec.id)]
            );
          } catch (e) {
            console.warn(`[BackupService] No se pudo actualizar estado local de audio ${rec.id}:`, e);
          }
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
            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              console.warn(`[BackupService] ⚠️ Backend no pudo marcar fantasma documento ${doc.id}: ${res.status} — ${errBody}. Marcando localmente.`);
            }
            try {
              await db.runAsync(
                `UPDATE scanned_documents SET is_backed_up = 1, cloud_url = 'ghost_file' WHERE id = ?`,
                [Number(doc.id)]
              );
            } catch (e) {
              console.warn(`[BackupService] No se pudo marcar fantasma local documento ${doc.id}:`, e);
            }
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
          if (!res2.ok) {
            const errBody = await res2.text().catch(() => '');
            console.warn(`[BackupService] ⚠️ Backend no pudo marcar documento ${doc.id}: ${res2.status} — ${errBody}. Marcando localmente.`);
          }
          try {
            await db.runAsync(
              `UPDATE scanned_documents SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
              [result.url, Number(doc.id)]
            );
          } catch (e) {
            console.warn(`[BackupService] No se pudo actualizar estado local de documento ${doc.id}:`, e);
          }
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
          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            console.warn(`[BackupService] ⚠️ Backend no pudo marcar transcripción ${t.id}: ${res.status} — ${errBody}. Marcando localmente.`);
          }
          try {
            if (t.type === 'audio') {
              await db.runAsync(
                `UPDATE audio_recordings SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
                [result.url, Number(t.id)]
              );
            } else {
              await db.runAsync(
                `UPDATE youtube_videos SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
                [result.url, Number(t.id)]
              );
            }
          } catch (e) {
            console.warn(`[BackupService] No se pudo actualizar estado local de transcripción ${t.id}:`, e);
          }
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
