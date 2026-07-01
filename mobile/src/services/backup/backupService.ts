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

    // Marcar como respaldado en el backend (no propagamos error)
    try {
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
    } catch (markErr) {
      console.warn(`[BackupService] ⚠️ Backend no pudo marcar ${type} ${itemId}:`, markErr);
    }

    // Siempre marcar localmente para evitar re-subidas infinitas aunque falle el backend
    const db = databaseService.getDb();
    try {
      if (type === 'transcript') {
        const transTable = transcriptType === 'youtube' ? 'youtube_transcripts' : 'audio_transcripts';
        const idColumn = transcriptType === 'youtube' ? 'video_id' : 'recording_id';
        await db.runAsync(
          `UPDATE ${transTable} SET is_backed_up = 1, cloud_url = ? WHERE ${idColumn} = ?`,
          [result.url, itemId]
        );
      } else {
        const tableName =
          type === 'photo' ? 'photos'
          : type === 'audio' ? 'audio_recordings'
          : 'scanned_documents';
        await db.runAsync(
          `UPDATE ${tableName} SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
          [result.url, itemId]
        );
      }
    } catch (dbErr) {
      console.warn(`[BackupService] No se pudo marcar localmente ${type} ${itemId}:`, dbErr);
    }

    console.log(`[BackupService] ÉXITO: ${type} ${itemId} respaldado.`);
    return result.url;
  } catch (err) {
    console.error(`[BackupService] ERROR: Fallo al subir archivo a la nube:`, err);
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
  INCLUDE_ASSESSMENT_FILES: 'backup_include_assessment_files',
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
  includeAssessmentFiles: boolean;
  lastRun: string | null;
  lastDownload: string | null;
}

export interface BackupStats {
  photos: { total: number; backed: number };
  audio: { total: number; backed: number };
  docs: { total: number; backed: number };
  transcripts: { total: number; backed: number };
  assessmentFiles: { total: number; backed: number };
  flashcardDecks: { total: number; backed: number };
  aiChats: { total: number; backed: number };
}

export interface BackupProgress {
  total: number;
  done: number;
  current: string;
  errors: number;
}

// ─── Leer / Escribir preferencias ───────────────────────────────────────────

export const getBackupPreferences = async (): Promise<BackupPreferences> => {
  const [enabled, autoUpload, autoDownload, photos, audio, docs, transcripts, assessmentFiles, lastRun, lastDownload] = await Promise.all([
    storageService.getSecure(BACKUP_PREFS.ENABLED),
    storageService.getSecure(BACKUP_PREFS.AUTO_UPLOAD),
    storageService.getSecure(BACKUP_PREFS.AUTO_DOWNLOAD),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_PHOTOS),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_AUDIO),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_DOCS),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_TRANSCRIPTS),
    storageService.getSecure(BACKUP_PREFS.INCLUDE_ASSESSMENT_FILES),
    storageService.getSecure(BACKUP_PREFS.LAST_RUN),
    storageService.getSecure(BACKUP_PREFS.LAST_DOWNLOAD),
  ]);

  return {
    enabled: enabled === 'true',
    autoUpload: autoUpload === 'true',
    autoDownload: autoDownload !== 'false',
    includePhotos: photos !== 'false',
    includeAudio: audio !== 'false',
    includeDocs: docs !== 'false',
    includeTranscripts: transcripts !== 'false',
    includeAssessmentFiles: assessmentFiles !== 'false',
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
  if (prefs.includeAssessmentFiles !== undefined)
    promises.push(storageService.saveSecure(BACKUP_PREFS.INCLUDE_ASSESSMENT_FILES, String(prefs.includeAssessmentFiles)));
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

    const [photoRow, audioRow, docRow, audioTransRow, ytTransRow, assessFileRow, deckRow, aiChatRow] = await Promise.all([
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM photos`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM audio_recordings`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM scanned_documents`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM audio_transcripts`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM youtube_transcripts`) as Promise<{ total: number; backed: number } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM assessment_files WHERE local_uri IS NOT NULL`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM flashcard_decks`) as Promise<{ total: number; backed: number | null } | undefined>,
      db.getFirstAsync(`SELECT COUNT(*) as total, SUM(CASE WHEN is_backed_up = 1 THEN 1 ELSE 0 END) as backed FROM ai_chats`) as Promise<{ total: number; backed: number | null } | undefined>,
    ]);

    const photoTotal = (photoRow as { total: number; backed: number | null } | undefined)?.total ?? 0;
    const photoBacked = (photoRow as { total: number; backed: number | null } | undefined)?.backed ?? 0;
    const audioTotal = (audioRow as { total: number; backed: number | null } | undefined)?.total ?? 0;
    const audioBacked = (audioRow as { total: number; backed: number | null } | undefined)?.backed ?? 0;
    const docTotal = (docRow as { total: number; backed: number | null } | undefined)?.total ?? 0;
    const docBacked = (docRow as { total: number; backed: number | null } | undefined)?.backed ?? 0;
    
    const transcriptTotal = ((audioTransRow as any)?.total ?? 0) + ((ytTransRow as any)?.total ?? 0);
    const transcriptBacked = ((audioTransRow as any)?.backed ?? 0) + ((ytTransRow as any)?.backed ?? 0);
    const assessFileTotal = (assessFileRow as any)?.total ?? 0;
    const assessFileBacked = (assessFileRow as any)?.backed ?? 0;
    const deckTotal = (deckRow as any)?.total ?? 0;
    const deckBacked = (deckRow as any)?.backed ?? 0;
    const aiChatTotal = (aiChatRow as any)?.total ?? 0;
    const aiChatBacked = (aiChatRow as any)?.backed ?? 0;

    return {
      photos: { total: photoTotal, backed: photoBacked },
      audio: { total: audioTotal, backed: audioBacked },
      docs: { total: docTotal, backed: docBacked },
      transcripts: { total: transcriptTotal, backed: transcriptBacked },
      assessmentFiles: { total: assessFileTotal, backed: assessFileBacked },
      flashcardDecks: { total: deckTotal, backed: deckBacked },
      aiChats: { total: aiChatTotal, backed: aiChatBacked },
    };
  } catch (err) {
    console.error('[BackupService] Error obteniendo estadísticas locales:', err);
    return { photos: { total: 0, backed: 0 }, audio: { total: 0, backed: 0 }, docs: { total: 0, backed: 0 }, transcripts: { total: 0, backed: 0 }, assessmentFiles: { total: 0, backed: 0 }, flashcardDecks: { total: 0, backed: 0 }, aiChats: { total: 0, backed: 0 } };
  }
}

/**
 * Obtiene items NO respaldados directamente desde SQLite local.
 * Fuente de verdad para el proceso de backup (is_backed_up = 0).
 */
async function getPendingItemsFromLocalDB(prefs: BackupPreferences): Promise<{
  photos: { id: string; uri: string; subject_id?: string }[];
  audio: { id: string; local_uri: string; name: string; subject_id?: string }[];
  docs: { id: string; local_uri: string; name?: string; subject_id?: string }[];
  transcripts: { id: string; type: 'audio' | 'youtube'; text: string; recording_id?: string; video_id?: string }[];
  assessmentFiles: { id: string; local_uri: string; file_name: string; file_type?: string; assessment_id: string }[];
  aiChats: { id: string; user_id: string; subject_id?: string; role: string; content: string }[];
  userPreferences: { key: string; value: string }[];
  flashcardDecks: { id: string; user_id: string; subject_id?: string; title: string; description?: string; linked_event_id?: string; avg_ease_factor?: number; total_reviews?: number; last_reviewed_at?: string }[];
  flashcards: { id: string; deck_id: string; front: string; back?: string; status?: string; direction?: string; ease_factor?: number; interval_days?: number; repetitions?: number; next_review_at?: string; fsrs_stability?: number; fsrs_difficulty?: number; source_context?: string }[];
}> {
  const db = databaseService.getDb();
  const result = {
    photos: [] as { id: string; uri: string; subject_id?: string }[],
    audio: [] as { id: string; local_uri: string; name: string; subject_id?: string }[],
    docs: [] as { id: string; local_uri: string; name?: string; subject_id?: string }[],
    transcripts: [] as { id: string; type: 'audio' | 'youtube'; text: string; recording_id?: string; video_id?: string }[],
    assessmentFiles: [] as { id: string; local_uri: string; file_name: string; file_type?: string; assessment_id: string }[],
    aiChats: [] as { id: string; user_id: string; subject_id?: string; role: string; content: string }[],
    userPreferences: [] as { key: string; value: string }[],
    flashcardDecks: [] as { id: string; user_id: string; subject_id?: string; title: string; description?: string; linked_event_id?: string; avg_ease_factor?: number; total_reviews?: number; last_reviewed_at?: string }[],
    flashcards: [] as { id: string; deck_id: string; front: string; back?: string; status?: string; direction?: string; ease_factor?: number; interval_days?: number; repetitions?: number; next_review_at?: string; fsrs_stability?: number; fsrs_difficulty?: number; source_context?: string }[],
  };

  try {
    // Fotos no respaldadas
    if (prefs.includePhotos) {
      const photos = await db.getAllAsync(
        `SELECT id, local_uri, subject_id FROM photos WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND local_uri IS NOT NULL AND local_uri != ''`
      );
      result.photos = photos.map((p: any) => ({ id: String(p.id), uri: p.local_uri, subject_id: p.subject_id ? String(p.subject_id) : undefined }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.photos.length} foto(s) pendientes`);
    }

    // Grabaciones de audio no respaldadas
    if (prefs.includeAudio) {
      const audio = await db.getAllAsync(
        `SELECT id, local_uri, name, subject_id FROM audio_recordings WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND local_uri IS NOT NULL AND local_uri != ''`
      );
      result.audio = audio.map((a: any) => ({ id: String(a.id), local_uri: a.local_uri, name: String(a.name), subject_id: a.subject_id ? String(a.subject_id) : undefined }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.audio.length} grabación(es) pendiente(s)`);
    }

    // Documentos no respaldados
    if (prefs.includeDocs) {
      const docs = await db.getAllAsync(
        `SELECT id, local_uri, subject_id FROM scanned_documents WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND local_uri IS NOT NULL AND local_uri != ''`
      );
      result.docs = docs.map((d: any) => ({ id: String(d.id), local_uri: d.local_uri, name: undefined, subject_id: d.subject_id ? String(d.subject_id) : undefined }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.docs.length} documento(s) pendiente(s)`);
    }

    // Transcripciones no respaldadas (desde tablas dedicadas)
    if (prefs.includeTranscripts) {
      const audioTranscripts = await db.getAllAsync(
        `SELECT id, recording_id, transcript_text FROM audio_transcripts WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND transcript_text IS NOT NULL AND transcript_text != ''`
      );
      result.transcripts.push(...audioTranscripts.map((t: any) => ({ id: String(t.id), type: 'audio' as const, text: t.transcript_text, recording_id: String(t.recording_id) })));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${audioTranscripts.length} transcripción(es) de audio pendiente(s)`);

      const ytTranscripts = await db.getAllAsync(
        `SELECT id, video_id, transcript_text FROM youtube_transcripts WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND transcript_text IS NOT NULL AND transcript_text != ''`
      );
      result.transcripts.push(...ytTranscripts.map((t: any) => ({ id: String(t.id), type: 'youtube' as const, text: t.transcript_text, video_id: String(t.video_id) })));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${ytTranscripts.length} transcripción(es) de YouTube pendiente(s)`);
    }
    // Soportes de evaluaciones no respaldados
    if (prefs.includeAssessmentFiles) {
      const assessFiles = await db.getAllAsync(
        `SELECT id, local_uri, file_name, file_type, assessment_id FROM assessment_files WHERE (is_backed_up IS NULL OR is_backed_up = 0) AND local_uri IS NOT NULL AND local_uri != ''`
      );
      result.assessmentFiles = assessFiles.map((f: any) => ({ id: String(f.id), local_uri: f.local_uri, file_name: f.file_name, file_type: f.file_type, assessment_id: String(f.assessment_id) }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.assessmentFiles.length} soporte(s) de evaluación pendiente(s)`);
    }
    // ── Chats de Zyren (AI) no respaldados ──
    // Solo respaldar los últimos 6 mensajes
    const unbackedChats: any[] = await db.getAllAsync(
      `SELECT ac.id, ac.user_id, ac.subject_id, ac.role, ac.content
       FROM ai_chats ac
       WHERE (ac.is_backed_up IS NULL OR ac.is_backed_up = 0)
       AND ac.content IS NOT NULL AND ac.content != ''
       ORDER BY ac.created_at DESC
       LIMIT 6`
    );
    result.aiChats = unbackedChats.map((c: any) => ({
      id: String(c.id),
      user_id: String(c.user_id),
      subject_id: c.subject_id ? String(c.subject_id) : undefined,
      role: String(c.role),
      content: String(c.content),
    }));
    console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.aiChats.length} chat(s) de IA pendiente(s)`);

    // ── Preferencias de usuario no respaldadas ──
    // Agrupar todo en un solo blob JSON para backup
    const unbackedPrefs: any[] = await db.getAllAsync(
      `SELECT up.key, up.value FROM user_preferences up
       WHERE (up.is_backed_up IS NULL OR up.is_backed_up = 0)`
    );
    result.userPreferences = unbackedPrefs.map((p: any) => ({
      key: String(p.key),
      value: String(p.value),
    }));
    console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.userPreferences.length} preferencia(s) pendiente(s)`);

    // ── Mazos de flashcards no respaldados ──
    const unbackedDecks: any[] = await db.getAllAsync(
      `SELECT id, user_id, subject_id, title, description, linked_event_id,
              avg_ease_factor, total_reviews, last_reviewed_at
       FROM flashcard_decks
       WHERE (is_backed_up IS NULL OR is_backed_up = 0)`
    );
    result.flashcardDecks = unbackedDecks.map((d: any) => ({
      id: String(d.id),
      user_id: String(d.user_id),
      subject_id: d.subject_id ? String(d.subject_id) : undefined,
      title: String(d.title),
      description: d.description ? String(d.description) : undefined,
      linked_event_id: d.linked_event_id ? String(d.linked_event_id) : undefined,
      avg_ease_factor: d.avg_ease_factor ?? undefined,
      total_reviews: d.total_reviews ?? undefined,
      last_reviewed_at: d.last_reviewed_at ? String(d.last_reviewed_at) : undefined,
    }));
    console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.flashcardDecks.length} mazo(s) pendiente(s)`);

    // ── Tarjetas individuales de los mazos pendientes (con métricas SRS) ──
    if (result.flashcardDecks.length > 0) {
      const deckIds = result.flashcardDecks.map(d => `'${d.id}'`).join(',');
      const unbackedCards: any[] = await db.getAllAsync(
        `SELECT id, deck_id, front, back, status, direction,
                ease_factor, interval_days, repetitions, next_review_at,
                fsrs_stability, fsrs_difficulty, source_context
         FROM flashcards
         WHERE deck_id IN (${deckIds})`
      );
      result.flashcards = unbackedCards.map((c: any) => ({
        id: String(c.id),
        deck_id: String(c.deck_id),
        front: String(c.front),
        back: c.back ? String(c.back) : undefined,
        status: c.status ? String(c.status) : undefined,
        direction: c.direction ? String(c.direction) : undefined,
        ease_factor: c.ease_factor ?? undefined,
        interval_days: c.interval_days ?? undefined,
        repetitions: c.repetitions ?? undefined,
        next_review_at: c.next_review_at ? String(c.next_review_at) : undefined,
        fsrs_stability: c.fsrs_stability ?? undefined,
        fsrs_difficulty: c.fsrs_difficulty ?? undefined,
        source_context: c.source_context ? String(c.source_context) : undefined,
      }));
      console.log(`[BackupService] getPendingItemsFromLocalDB: ${result.flashcards.length} tarjeta(s) pendiente(s)`);
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
  aiChats: number;
  userPreferences: number;
}> => {
  const db = databaseService.getDb();
  const result = { photos: 0, audio: 0, docs: 0, audioTranscripts: 0, ytTranscripts: 0, aiChats: 0, userPreferences: 0 };

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
      `UPDATE audio_transcripts SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.audioTranscripts = audioTransChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en audio_transcripts:', e);
  }

  try {
    const { changes: ytTransChanges } = await db.runAsync(
      `UPDATE youtube_transcripts SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.ytTranscripts = ytTransChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en youtube_transcripts:', e);
  }

  try {
    const { changes: aiChatChanges } = await db.runAsync(
      `UPDATE ai_chats SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.aiChats = aiChatChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en ai_chats:', e);
  }

  try {
    const { changes: prefChanges } = await db.runAsync(
      `UPDATE user_preferences SET is_backed_up = 0, cloud_url = NULL
       WHERE is_backed_up = 1 AND (cloud_url IS NULL OR cloud_url = '' OR cloud_url = 'ghost_file')`
    );
    result.userPreferences = prefChanges ?? 0;
  } catch (e) {
    console.warn('[BackupService] resetStuckBackupFlags: error en user_preferences:', e);
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

  // Detectar si estamos en modo offline con probe de conectividad
  const { useLocalAIStore } = await import('../../store/useLocalAIStore');
  let isOffline = !useConnectivityStore.getState().isOnline || useLocalAIStore.getState().forceOfflineMode;
  if (!isOffline) {
    try {
      const probe = await fetchWithFallback('/health', { method: 'HEAD' });
      isOffline = !probe;
    } catch {
      isOffline = true;
      console.warn('[BackupService] Probe de conectividad falló — asumiendo offline.');
    }
  }
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
           WHERE (is_backed_up IS NULL OR is_backed_up = 0)`
        );
        console.log(`[BackupService] Fase 0a: ${localOnlyPhotos.length} foto(s) sin registro en backend.`);
        for (const photo of localOnlyPhotos) {
          try {
            await fetchWithFallback('/photos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: photo.id, subject_id: photo.subject_id, local_uri: photo.local_uri, es_favorita: photo.es_favorita, ocr_text: photo.ocr_text, group_id: photo.group_id, userId }),
            });
          } catch (_e) {
            // Ignorar — el UPSERT en /backup/mark lo registrará al marcar
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
           WHERE (is_backed_up IS NULL OR is_backed_up = 0)`
        );
        console.log(`[BackupService] Fase 0b: ${localOnlyAudio.length} grabación(es) sin registro en backend.`);
        for (const rec of localOnlyAudio) {
          try {
            await fetchWithFallback('/audio-recordings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: rec.id, user_id: Number(rec.user_id || userId), subject_id: rec.subject_id, name: rec.name, local_uri: rec.local_uri, duration: rec.duration }),
            });
          } catch (_e) {
            // Ignorar
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
           WHERE (is_backed_up IS NULL OR is_backed_up = 0)`
        );
        console.log(`[BackupService] Fase 0c: ${localOnlyDocs.length} documento(s) sin registro en backend.`);
        for (const doc of localOnlyDocs) {
          try {
            await fetchWithFallback('/scanned_documents', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: doc.id, user_id: doc.user_id || userId, subject_id: doc.subject_id, local_uri: doc.local_uri, ocr_text: doc.ocr_text }),
            });
          } catch (_e) {
            // Ignorar
          }
        }
      } catch (e) {
        console.warn('[BackupService] Fase 0c: Error leyendo documentos locales:', e);
      }
    }
    // ── Fase 0d: Soportes de evaluaciones sin registro en backend ──
    if (prefs.includeAssessmentFiles) {
      try {
        const localOnlyFiles: any[] = await db.getAllAsync(
          `SELECT id, assessment_id, file_name, file_type, local_uri, file_size FROM assessment_files
           WHERE (is_backed_up IS NULL OR is_backed_up = 0)`
        );
        console.log(`[BackupService] Fase 0d: ${localOnlyFiles.length} soporte(s) de evaluación sin registro en backend.`);
        for (const f of localOnlyFiles) {
          try {
            await fetchWithFallback(`/assessments/${f.assessment_id}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: f.id, file_name: f.file_name, file_type: f.file_type, local_uri: f.local_uri, file_size: f.file_size }),
            });
          } catch (_e) { /* ignorar — se registrará al marcar */ }
        }
      } catch (e) {
        console.warn('[BackupService] Fase 0d: Error leyendo soportes de evaluaciones locales:', e);
      }
    }
    } // Cierre de if (!isOffline)

    // ── Fase 0e: Sincronizar mazos locales (MMKV) al backend ──
    if (!isOffline) {
      try {
        await syncLocalFlashcardsToBackend();
        console.log('[BackupService] Fase 0e: Sincronización de mazos locales completada.');
      } catch (e) {
        console.warn('[BackupService] Fase 0e: Error sincronizando mazos locales:', e);
      }
    }

  // ──────────────────────────────────────────────────────────────────
  // FASE 1: Obtener ítems pendientes desde SQLite local y subirlos
  // Siempre usa la BD local como fuente de verdad (is_backed_up = 0).
  // ──────────────────────────────────────────────────────────────────
  const pending = await getPendingItemsFromLocalDB(prefs);
  const pendingCount = pending.photos.length + pending.audio.length + pending.docs.length + pending.transcripts.length + pending.assessmentFiles.length + pending.aiChats.length + (pending.flashcardDecks?.length || 0) + (pending.flashcards?.length || 0);
  console.log(`[BackupService] Fase 1: ${pendingCount} item(s) pendientes desde BD local`);

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
              body: JSON.stringify({ type: 'photo', id: photo.id, cloud_url: 'ghost_file', subject_id: photo.subject_id }),
            });
            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              console.warn(`[BackupService] ⚠️ Backend no pudo marcar fantasma foto ${photo.id}: ${res.status} — ${errBody}. Marcando localmente.`);
            }
            try {
              await db.runAsync(
                `UPDATE photos SET is_backed_up = 1, cloud_url = 'ghost_file' WHERE id = ?`,
                [photo.id]
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
            body: JSON.stringify({ type: 'photo', id: photo.id, cloud_url: result.url, subject_id: (photo as any).subject_id }),
          });
          if (!res2.ok) {
            const errBody = await res2.text().catch(() => '');
            console.warn(`[BackupService] ⚠️ Backend no pudo marcar foto ${photo.id}: ${res2.status} — ${errBody}. Marcando localmente.`);
          }
          try {
            await db.runAsync(
              `UPDATE photos SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
              [result.url, photo.id]
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
              body: JSON.stringify({ type: 'audio', id: rec.id, cloud_url: 'ghost_file', name: rec.name, subject_id: rec.subject_id }),
            });
            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              console.warn(`[BackupService] ⚠️ Backend no pudo marcar fantasma audio ${rec.id}: ${res.status} — ${errBody}. Marcando localmente.`);
            }
            try {
              await db.runAsync(
                `UPDATE audio_recordings SET is_backed_up = 1, cloud_url = 'ghost_file' WHERE id = ?`,
                [rec.id]
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
            body: JSON.stringify({ type: 'audio', id: rec.id, cloud_url: result.url, name: rec.name, subject_id: rec.subject_id }),
          });
          if (!res2.ok) {
            const errBody = await res2.text().catch(() => '');
            console.warn(`[BackupService] ⚠️ Backend no pudo marcar audio ${rec.id}: ${res2.status} — ${errBody}. Marcando localmente.`);
          }
          try {
            await db.runAsync(
              `UPDATE audio_recordings SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
              [result.url, rec.id]
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
              body: JSON.stringify({ type: 'document', id: doc.id, cloud_url: 'ghost_file', name: doc.name, subject_id: doc.subject_id }),
            });
            if (!res.ok) {
              const errBody = await res.text().catch(() => '');
              console.warn(`[BackupService] ⚠️ Backend no pudo marcar fantasma documento ${doc.id}: ${res.status} — ${errBody}. Marcando localmente.`);
            }
            try {
              await db.runAsync(
                `UPDATE scanned_documents SET is_backed_up = 1, cloud_url = 'ghost_file' WHERE id = ?`,
                [doc.id]
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
            body: JSON.stringify({ type: 'document', id: doc.id, cloud_url: result.url, name: doc.name, subject_id: doc.subject_id }),
          });
          if (!res2.ok) {
            const errBody = await res2.text().catch(() => '');
            console.warn(`[BackupService] ⚠️ Backend no pudo marcar documento ${doc.id}: ${res2.status} — ${errBody}. Marcando localmente.`);
          }
          try {
            await db.runAsync(
              `UPDATE scanned_documents SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
              [result.url, doc.id]
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
                `UPDATE audio_transcripts SET is_backed_up = 1, cloud_url = COALESCE(cloud_url, ?) WHERE recording_id = ?`,
                [result.url, t.recording_id || t.id]
              );
            } else {
              await db.runAsync(
                `UPDATE youtube_transcripts SET is_backed_up = 1, cloud_url = COALESCE(cloud_url, ?) WHERE video_id = ?`,
                [result.url, t.video_id || t.id]
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

  // ── Soportes de Evaluaciones ──
  if (prefs.includeAssessmentFiles) {
    for (const af of (pending.assessmentFiles || [])) {
      tasks.push(async () => {
        try {
          console.log(`[BackupService] Iniciando backup de soporte de evaluación ID: ${af.id} (${af.file_name})`);
          const fileInfo = await FileSystem.getInfoAsync(af.local_uri);
          if (!fileInfo.exists) {
            console.warn(`[BackupService] Archivo fantasma detectado (soporte ${af.id}). Marcando localmente.`);
            await db.runAsync(
              `UPDATE assessment_files SET is_backed_up = 1, cloud_url = 'ghost_file' WHERE id = ?`,
              [af.id]
            );
            uploaded++;
            return;
          }
          const ext = af.file_name.split('.').pop() || 'bin';
          const mime = af.file_type || 'application/octet-stream';
          const result = await uploadFileToUploadthing(af.local_uri, `assessment_file_${af.id}.${ext}`, mime);
          console.log(`[BackupService] ÉXITO: Soporte de evaluación subido. URL: ${result.url}`);
          // Marcar en backend
          try {
            await fetchWithFallback(`/assessments/${af.assessment_id}/files`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: af.id, file_name: af.file_name, file_type: af.file_type, cloud_url: result.url }),
            });
          } catch (_e) { /* Ignorar fallo de marca en backend */ }
          // Marcar localmente siempre
          await db.runAsync(
            `UPDATE assessment_files SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
            [result.url, af.id]
          );
          console.log(`[BackupService] ÉXITO: Soporte ${af.id} respaldado.`);
          uploaded++;
        } catch (err) {
          console.error(`[BackupService] ERROR: Falló el backup de soporte ${af.id}:`, err);
          errors++;
        }
      });
    }
  }

  // ── Chats de IA (subir como .json) ──
  for (const chat of (pending.aiChats || [])) {
    tasks.push(async () => {
      try {
        console.log(`[BackupService] Iniciando backup de chat IA ID: ${chat.id}`);
        const chatPayload = JSON.stringify({ id: chat.id, user_id: chat.user_id, subject_id: chat.subject_id, role: chat.role, content: chat.content }, null, 2);
        const tempUri = `${FileSystem.cacheDirectory}ai_chat_${chat.id}.json`;
        await FileSystem.writeAsStringAsync(tempUri, chatPayload, { encoding: FileSystem.EncodingType.UTF8 });

        const result = await uploadFileToUploadthing(tempUri, `ai_chat_${chat.id}.json`, 'application/json');
        await FileSystem.deleteAsync(tempUri, { idempotent: true });

        try {
          await fetchWithFallback(`/backup/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'ai_chat', id: chat.id, user_id: chat.user_id, subject_id: chat.subject_id, cloud_url: result.url }),
          });
        } catch (_e) { /* ignora fallo de marca en backend */ }
        try {
          await db.runAsync(
            `UPDATE ai_chats SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
            [result.url, chat.id]
          );
        } catch (e) {
          console.warn(`[BackupService] No se pudo marcar localmente chat IA ${chat.id}:`, e);
        }
        console.log(`[BackupService] ÉXITO: Chat IA ${chat.id} respaldado.`);
        uploaded++;
      } catch (err) {
        console.error(`[BackupService] ERROR: Falló el backup de chat IA ${chat.id}:`, err);
        errors++;
      }
    });
  }

  // ── Preferencias de usuario (subir todas como un solo .json) ──
  if (pending.userPreferences.length > 0) {
    tasks.push(async () => {
      try {
        console.log(`[BackupService] Iniciando backup de preferencias de usuario (${pending.userPreferences.length} clave(s))`);
        const prefsPayload = JSON.stringify(pending.userPreferences, null, 2);
        const tempUri = `${FileSystem.cacheDirectory}user_preferences.json`;
        await FileSystem.writeAsStringAsync(tempUri, prefsPayload, { encoding: FileSystem.EncodingType.UTF8 });

        const result = await uploadFileToUploadthing(tempUri, 'user_preferences.json', 'application/json');
        await FileSystem.deleteAsync(tempUri, { idempotent: true });

        // Marcar todas las preferencias como respaldadas
        for (const pref of pending.userPreferences) {
          try {
            await fetchWithFallback(`/backup/mark`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'user_preference', key: pref.key, cloud_url: result.url }),
            });
          } catch (_e) { /* ignora */ }
          try {
            await db.runAsync(
              `UPDATE user_preferences SET is_backed_up = 1, cloud_url = ? WHERE key = ?`,
              [result.url, pref.key]
            );
          } catch (e) {
            console.warn(`[BackupService] No se pudo marcar localmente preferencia ${pref.key}:`, e);
          }
        }
        console.log(`[BackupService] ÉXITO: Preferencias de usuario respaldadas.`);
        uploaded += pending.userPreferences.length;
      } catch (err) {
        console.error(`[BackupService] ERROR: Falló el backup de preferencias de usuario:`, err);
        errors += pending.userPreferences.length;
      }
    });
  }

  // ── Mazos de flashcards (mazo + tarjetas con métricas SRS en un solo JSON por mazo) ──
  for (const deck of (pending.flashcardDecks || [])) {
    tasks.push(async () => {
      try {
        const deckCards = (pending.flashcards || []).filter(c => c.deck_id === deck.id);
        let subjectData = null;
        if (deck.subject_id) {
          try {
            subjectData = await db.getFirstAsync('SELECT * FROM subjects WHERE id = ?', [deck.subject_id]);
          } catch {}
        }
        const deckPayload = JSON.stringify({ deck, cards: deckCards, subject: subjectData }, null, 2);
        const tempUri = `${FileSystem.cacheDirectory}flashcard_deck_${deck.id}.json`;
        await FileSystem.writeAsStringAsync(tempUri, deckPayload, { encoding: FileSystem.EncodingType.UTF8 });
        const uploadResult = await uploadFileToUploadthing(tempUri, `flashcard_deck_${deck.id}.json`, 'application/json');
        await FileSystem.deleteAsync(tempUri, { idempotent: true });

        try {
          await fetchWithFallback('/backup/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'flashcard_deck',
            id: deck.id,
            cloud_url: uploadResult.url,
            title: deck.title,
            subject_id: deck.subject_id ?? null,
            linked_event_id: deck.linked_event_id ?? null,
          }),
          });
        } catch (_e) { /* ignorar fallo backend */ }
        try {
          await db.runAsync(
            `UPDATE flashcard_decks SET is_backed_up = 1, cloud_url = ? WHERE id = ?`,
            [uploadResult.url, deck.id]
          );
        } catch (e) {
          console.warn(`[BackupService] No se pudo marcar localmente mazo ${deck.id}:`, e);
        }
        console.log(`[BackupService] ÉXITO: Mazo ${deck.id} (${deckCards.length} tarjetas) respaldado.`);
        uploaded++;
      } catch (err) {
        console.error(`[BackupService] ERROR: Falló el backup de mazo ${deck.id}:`, err);
        errors++;
      }
    });
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

// ─── Sync local flashcards to backend ─────────────────────────────────────────

export const syncLocalFlashcardsToBackend = async (): Promise<void> => {
  try {
    const { createMMKV } = await import('react-native-mmkv');
    const storage = createMMKV();
    const { getLocalDecks, deleteLocalDeck } = await import('../localFlashcardService');
    const { createFlashcardDeck } = await import('../api/flashcards');

    const localDecks = getLocalDecks().filter((d: any) => d._local);
    if (localDecks.length === 0) {
      console.log('[BackupService] No hay mazos locales para sincronizar.');
      return;
    }

    console.log(`[BackupService] Sincronizando ${localDecks.length} mazo(s) local(es) al backend...`);

    for (const deck of localDecks) {
      try {
        const createdDeck = await createFlashcardDeck({
          id: String(deck.id),
          title: deck.title,
          description: deck.description,
          subject_id: deck.subject_id ? String(deck.subject_id) : undefined,
          linked_event_id: (deck as any).linked_event_id ?? undefined,
          avg_ease_factor: (deck as any).avg_ease_factor ?? undefined,
          total_reviews: (deck as any).total_reviews ?? undefined,
          last_reviewed_at: (deck as any).last_reviewed_at ?? undefined,
          card_count: deck.card_count ?? 0,
        });
        console.log(`[BackupService] Mazo ${deck.id} sincronizado. Nuevo ID remoto: ${createdDeck?.id}`);

        // Leer cards locales desde MMKV
        const cardsKey = `cache:flashcards_by_deck:${deck.id}`;
        const raw = storage.getString(cardsKey);
        let cards: any[] = [];
        if (raw) {
          const entry = JSON.parse(raw);
          cards = entry.data || entry || [];
        }

        const { createFlashcard } = await import('../api/flashcards');
        for (const card of cards) {
          try {
            await createFlashcard({
              deck_id: String(createdDeck?.id || deck.id),
              front: card.front || card.content?.front || '',
              back: card.back || card.content?.back || '',
              id: String(card.id),
              ease_factor: card.ease_factor ?? card.ease ?? undefined,
              interval_days: card.interval_days ?? card.interval ?? undefined,
              repetitions: card.repetitions ?? card.reps ?? undefined,
              next_review_at: card.next_review_at ?? undefined,
              fsrs_stability: card.fsrs_stability ?? undefined,
              fsrs_difficulty: card.fsrs_difficulty ?? undefined,
            });
          } catch (cardErr) {
            console.warn(`[BackupService] Error sincronizando card ${card.id}:`, cardErr);
          }
        }

        // Eliminar copia local tras sincronización exitosa
        deleteLocalDeck(String(deck.id));
        storage.remove(cardsKey);
        console.log(`[BackupService] Mazo local ${deck.id} eliminado.`);
      } catch (deckErr) {
        console.warn(`[BackupService] Error sincronizando mazo ${deck.id}:`, deckErr);
      }
    }

    console.log('[BackupService] Sincronización de mazos locales completada.');
  } catch (err) {
    console.error('[BackupService] Error en syncLocalFlashcardsToBackend:', err);
  }
};
