/**
 * Download Service (Mobile)
 * Descarga archivos desde la nube (Uploadthing) al almacenamiento local del dispositivo.
 *
 * Usa la API de clases de expo-file-system v2 (SDK 53+):
 *   - `Directory`  → representa una carpeta
 *   - `File`       → representa un archivo
 *   - `Paths`      → acceso a directorios del sistema (documentDirectory, etc.)
 *   - `File.downloadFileAsync(url, destDir)` → descarga un archivo
 *
 * Flujo:
 * 1. GET /api/backup/cloud-items → lista de ítems en la nube
 * 2. Para cada ítem: File.downloadFileAsync(cloud_url, destDir)
 * 3. Reportar progreso al llamador
 */
import * as FileSystem from 'expo-file-system/legacy';
import { fetchWithFallback, parseJsonSafely } from '../api/client';
import { getBackupPreferences } from './backupService';
import { databaseService } from '../database/DatabaseService';

// ─── Directorios de descarga ─────────────────────────────────────────────────

/** Obtiene (y crea si no existe) un subdirectorio dentro de documentDirectory */
const getDownloadSubdirUri = async (subdir: string): Promise<string> => {
  const baseDir = `${FileSystem.documentDirectory}threshold_cloud/`;
  const fullDir = `${baseDir}${subdir}/`;

  const info = await FileSystem.getInfoAsync(fullDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(fullDir, { intermediates: true });
  }
  return fullDir;
};

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CloudItem {
  id: number;
  cloud_url: string;
  local_uri?: string;
  name?: string;
  subject_id?: number;
  subject_name?: string;
  duration?: number;
  created_at?: string;
  transcript_type?: 'audio' | 'youtube';
  transcript_text?: string;
  summary_text?: string;
  recording_id?: number;
  video_id?: number;
  recording_name?: string;
  video_title?: string;
}

export interface CloudItemsResponse {
  photos: CloudItem[];
  audio: CloudItem[];
  docs: CloudItem[];
  transcripts: CloudItem[];
  assessmentFiles: CloudItem[];
  aiChats?: CloudItem[];
  flashcardDecks?: CloudItem[];
}

export interface DownloadProgress {
  total: number;
  done: number;
  current: string;
  errors: number;
  skipped: number;
}

export interface DownloadResult {
  downloaded: number;
  skipped: number;
  errors: number;
}

// ─── Descarga principal ───────────────────────────────────────────────────────

/**
 * Descarga todos los archivos en la nube al dispositivo actual.
 * Archivos que ya existen localmente (mismo nombre en el subdirectorio) se omiten (skip).
 *
 * @param onProgress - Callback con progreso por ítem
 * @returns Resumen con archivos descargados, omitidos y errores
 */
export const downloadCloudItems = async (
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> => {
  console.log(`[DownloadService] downloadCloudItems iniciado`);
  const prefs = await getBackupPreferences();
  const result: DownloadResult = {
    downloaded: 0,
    skipped: 0,
    errors: 0,
  };

  // Obtener lista de ítems en la nube
  const response = await fetchWithFallback('/backup/cloud-items');
  if (!response.ok) throw new Error('No se pudo obtener los archivos de la nube.');

  const data = (await parseJsonSafely(response)) as CloudItemsResponse;
  console.log(`[DownloadService] cloud-items response:`, JSON.stringify({
    photos: data.photos?.length ?? 0,
    audio: data.audio?.length ?? 0,
    docs: data.docs?.length ?? 0,
    transcripts: data.transcripts?.length ?? 0,
    assessmentFiles: data.assessmentFiles?.length ?? 0,
    flashcardDecks: data.flashcardDecks?.length ?? 0,
    aiChats: data.aiChats?.length ?? 0,
  }));
  console.log(`[DownloadService] prefs:`, JSON.stringify(prefs));
  const tasks: (() => Promise<void>)[] = [];

  // ── Fotos ──
  if (prefs.includePhotos) {
    const photosDir = await getDownloadSubdirUri('photos');
    for (const item of data.photos || []) {
      tasks.push(async () => {
        const nameExt = item.name?.match(/\.([^.]+)$/)?.[1];
        const ext = nameExt || 'jpg';
        const baseName = (item.name || `photo_${item.id}`).replace(/\.[^.]+$/, '').replace(/[/\\:*?"<>|]/g, '_');
        const filename = `${baseName}.${ext}`;
        const localUri = `${photosDir}${filename}`;
        
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) { result.skipped++; return; }
        if (item.cloud_url === 'ghost_file') { result.skipped++; return; }

        try {
          console.log(`[DownloadService] Descargando Foto: ${item.cloud_url} -> ${localUri}`);
          await FileSystem.downloadAsync(item.cloud_url, localUri);
          // Actualizar la URI local en el servidor para que la app pueda ver el archivo
          await fetchWithFallback('/backup/restore-local-uri', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'photo', id: item.id, local_uri: localUri }),
          });
          
          try {
            await databaseService.getDb().runAsync(
              `INSERT INTO photos (id, subject_id, local_uri, cloud_url, created_at, is_backed_up)
               VALUES (?, ?, ?, ?, ?, 1)
               ON CONFLICT(id) DO UPDATE SET local_uri = excluded.local_uri, cloud_url = excluded.cloud_url, is_backed_up = 1`,
              [item.id, item.subject_id ?? null, localUri, item.cloud_url ?? null, item.created_at || new Date().toISOString()]
            );
          } catch (dbErr) {
            console.warn(`[DownloadService] No se pudo guardar foto ${item.id} en SQLite local:`, dbErr);
          }
          
          result.downloaded++;
        } catch (err) {
          console.error(`[DownloadService] ERROR descargando foto ${item.id}:`, err);
          result.errors++;
        }
      });
    }
  }

  // ── Audio ──
  if (prefs.includeAudio) {
    const audioDir = await getDownloadSubdirUri('audio');
    for (const item of data.audio || []) {
      tasks.push(async () => {
        const nameExt = item.name?.match(/\.([^.]+)$/)?.[1];
        const ext = nameExt || 'm4a';
        const baseName = (item.name || `audio_${item.id}`).replace(/\.[^.]+$/, '').replace(/[/\\:*?"<>|]/g, '_');
        const filename = `${baseName}.${ext}`;
        const localUri = `${audioDir}${filename}`;

        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) { result.skipped++; return; }
        if (item.cloud_url === 'ghost_file') { result.skipped++; return; }

        try {
          console.log(`[DownloadService] Descargando Audio: ${item.cloud_url} -> ${localUri}`);
          await FileSystem.downloadAsync(item.cloud_url, localUri);
          await fetchWithFallback('/backup/restore-local-uri', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'audio', id: item.id, local_uri: localUri }),
          });

          try {
            await databaseService.getDb().runAsync(
              `INSERT INTO audio_recordings (id, name, local_uri, cloud_url, subject_id, duration, created_at, is_backed_up)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)
               ON CONFLICT(id) DO UPDATE SET local_uri = excluded.local_uri, cloud_url = excluded.cloud_url, is_backed_up = 1`,
              [item.id, item.name || `Audio ${item.id}`, localUri, item.cloud_url ?? null, item.subject_id ?? null, item.duration ?? 0, item.created_at || new Date().toISOString()]
            );
          } catch (dbErr) {
            console.warn(`[DownloadService] No se pudo guardar audio ${item.id} en SQLite local:`, dbErr);
          }

          result.downloaded++;
        } catch (err) {
          console.error(`[DownloadService] ERROR descargando audio ${item.id}:`, err);
          result.errors++;
        }
      });
    }
  }

  // ── Documentos ──
  if (prefs.includeDocs) {
    const docsDir = await getDownloadSubdirUri('docs');
    for (const item of data.docs || []) {
      tasks.push(async () => {
        const nameExt = item.name?.match(/\.([^.]+)$/)?.[1];
        const ext = nameExt || 'pdf';
        const baseName = (item.name || `doc_${item.id}`).replace(/\.[^.]+$/, '').replace(/[/\\:*?"<>|]/g, '_');
        const filename = `${baseName}.${ext}`;
        const localUri = `${docsDir}${filename}`;

        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) { result.skipped++; return; }
        if (item.cloud_url === 'ghost_file') { result.skipped++; return; }

        try {
          console.log(`[DownloadService] Descargando Doc: ${item.cloud_url} -> ${localUri}`);
          await FileSystem.downloadAsync(item.cloud_url, localUri);
          await fetchWithFallback('/backup/restore-local-uri', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'document', id: item.id, local_uri: localUri }),
          });

          try {
            await databaseService.getDb().runAsync(
              `INSERT INTO scanned_documents (id, name, local_uri, cloud_url, subject_id, created_at, is_backed_up)
               VALUES (?, ?, ?, ?, ?, ?, 1)
               ON CONFLICT(id) DO UPDATE SET local_uri = excluded.local_uri, cloud_url = excluded.cloud_url, is_backed_up = 1`,
              [item.id, item.name || `Doc ${item.id}`, localUri, item.cloud_url ?? null, item.subject_id ?? null, item.created_at || new Date().toISOString()]
            );
          } catch (dbErr) {
            console.warn(`[DownloadService] No se pudo guardar doc ${item.id} en SQLite local:`, dbErr);
          }

          result.downloaded++;
        } catch (err) {
          console.error(`[DownloadService] ERROR descargando doc ${item.id}:`, err);
          result.errors++;
        }
      });
    }
  }

  // ── Transcripciones ──
  if (prefs.includeTranscripts) {
    // Las transcripciones se guardan en la misma carpeta que usa RecordingDetail.tsx
    const transcriptsDir = `${FileSystem.documentDirectory}Threshold/transcripts/`;
    const transcriptsDirInfo = await FileSystem.getInfoAsync(transcriptsDir);
    if (!transcriptsDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(transcriptsDir, { intermediates: true });
    }

    for (const item of data.transcripts || []) {
      tasks.push(async () => {
        if (!item.transcript_text) { result.skipped++; return; }
        if (item.cloud_url === 'ghost_file') { result.skipped++; return; }

        let transcriptUri = '';
        let summaryUri = '';
        if (item.transcript_type === 'youtube') {
          const key = item.video_id?.toString() ?? item.id?.toString();
          transcriptUri = `${transcriptsDir}transcript_video_${key}.json`;
          summaryUri = `${transcriptsDir}summary_video_${key}.json`;
        } else {
          const key = item.recording_id?.toString() ?? item.id?.toString();
          transcriptUri = `${transcriptsDir}transcript_${key}.json`;
          summaryUri = `${transcriptsDir}summary_${key}.json`;
        }

        const info = await FileSystem.getInfoAsync(transcriptUri);
        if (info.exists) { result.skipped++; return; }

        try {
          // Escribir en el formato JSON que espera RecordingDetail/VideoDetail: { text, date }
          const transcriptContent = JSON.stringify({ text: item.transcript_text, date: new Date().toISOString() });
          await FileSystem.writeAsStringAsync(transcriptUri, transcriptContent);
          
          if (item.summary_text) {
            const summaryContent = JSON.stringify({ text: item.summary_text, date: new Date().toISOString() });
            await FileSystem.writeAsStringAsync(summaryUri, summaryContent);
          }
          
          try {
            if (item.transcript_type === 'youtube') {
              const videoId = item.video_id?.toString() ?? item.id?.toString() ?? '';
              await databaseService.getDb().runAsync(
                `INSERT INTO youtube_transcripts (id, video_id, transcript_text, summary_text, cloud_url, is_backed_up)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON CONFLICT(video_id) DO UPDATE SET transcript_text = excluded.transcript_text, summary_text = excluded.summary_text, cloud_url = excluded.cloud_url, is_backed_up = 1`,
                [item.id, videoId, item.transcript_text ?? null, item.summary_text ?? null, item.cloud_url ?? null]
              );
            } else {
              const recId = item.recording_id?.toString() ?? item.id?.toString() ?? '';
              await databaseService.getDb().runAsync(
                `INSERT INTO audio_transcripts (id, recording_id, transcript_text, summary_text, cloud_url, is_backed_up)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON CONFLICT(recording_id) DO UPDATE SET transcript_text = excluded.transcript_text, summary_text = excluded.summary_text, cloud_url = excluded.cloud_url, is_backed_up = 1`,
                [item.id, recId, item.transcript_text ?? null, item.summary_text ?? null, item.cloud_url ?? null]
              );
            }
          } catch (dbErr) {
            console.warn(`[DownloadService] No se pudo guardar transcripción ${item.id} en SQLite local:`, dbErr);
          }
          
          result.downloaded++;
        } catch (err) {
          console.error(`[DownloadService] ERROR restaurando transcripción/resumen ${item.id}:`, err);
          result.errors++;
        }
      });
    }
  }

  // ── Soportes de Evaluaciones ──
  if (prefs.includeAssessmentFiles) {
    const assessFilesDir = await getDownloadSubdirUri('assessment_files');
    for (const item of data.assessmentFiles || []) {
      tasks.push(async () => {
        const ext = item.name?.split('.').pop() || 'bin';
        const baseName = (item.name || `assessment_file_${item.id}`).replace(/\.[^.]+$/, '').replace(/[/\\:*?"<>|]/g, '_');
        const filename = `${baseName}.${ext}`;
        const localUri = `${assessFilesDir}${filename}`;

        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) { result.skipped++; return; }
        if (item.cloud_url === 'ghost_file') { result.skipped++; return; }

        try {
          console.log(`[DownloadService] Descargando Soporte de Evaluación: ${item.cloud_url} -> ${localUri}`);
          await FileSystem.downloadAsync(item.cloud_url, localUri);
          await fetchWithFallback('/backup/restore-local-uri', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'assessment_file', id: item.id, local_uri: localUri }),
          });

          try {
            await databaseService.getDb().runAsync(
              `INSERT INTO assessment_files (id, assessment_id, file_name, file_type, local_uri, cloud_url, created_at, is_backed_up)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)
               ON CONFLICT(id) DO UPDATE SET local_uri = excluded.local_uri, cloud_url = excluded.cloud_url, is_backed_up = 1`,
              [item.id, (item as any).assessment_id ?? null, item.name || `Archivo ${item.id}`, 'application/octet-stream', localUri, item.cloud_url ?? null, item.created_at || new Date().toISOString()]
            );
          } catch (dbErr) {
            console.warn(`[DownloadService] No se pudo guardar soporte ${item.id} en SQLite local:`, dbErr);
          }

          result.downloaded++;
        } catch (err) {
          console.error(`[DownloadService] ERROR descargando soporte de evaluación ${item.id}:`, err);
          result.errors++;
        }
      });
    }
  }

  // ── Chats IA (Procesados por chunks JSON o individuales) ──
  if (data.aiChats && data.aiChats.length > 0) {
    // Agrupar por cloud_url para no descargar el mismo chunk varias veces
    const chunksToDownload = new Map<string, any[]>();
    const localChats: any[] = [];

    for (const chat of data.aiChats) {
      if (chat.cloud_url && chat.cloud_url.endsWith('.json')) {
        if (!chunksToDownload.has(chat.cloud_url)) {
          chunksToDownload.set(chat.cloud_url, []);
        }
        chunksToDownload.get(chat.cloud_url)!.push(chat);
      } else {
        localChats.push(chat); // Chats que no usan JSON chunk
      }
    }

    // Tareas para chats sueltos (sin JSON)
    for (const chat of localChats) {
      tasks.push(async () => {
        try {
          const role = chat.role || 'user';
          const content = chat.content || '';
          const subjectId = chat.subject_id || null;
          await databaseService.getDb().runAsync(
            `INSERT INTO ai_chats (id, subject_id, role, content, cloud_url, created_at, is_backed_up)
             VALUES (?, ?, ?, ?, ?, ?, 1)
             ON CONFLICT(id) DO UPDATE SET content = excluded.content, cloud_url = excluded.cloud_url, is_backed_up = 1`,
            [chat.id, subjectId ?? null, role, content, chat.cloud_url ?? null, chat.created_at || new Date().toISOString()]
          );
          result.downloaded++;
        } catch (err) {
          console.error(`[DownloadService] ERROR guardando chat IA ${chat.id} en SQLite local:`, err);
          result.errors++;
        }
      });
    }

    // Tareas para descargar y procesar los chunks JSON
    for (const [cloudUrl, chatsInChunk] of chunksToDownload.entries()) {
      tasks.push(async () => {
        try {
          const tempUri = `${FileSystem.cacheDirectory}ai_chats_${Date.now()}.json`;
          await FileSystem.downloadAsync(cloudUrl, tempUri);
          const chunkStr = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.UTF8 });
          const parsedChunk = JSON.parse(chunkStr);
          await FileSystem.deleteAsync(tempUri, { idempotent: true });

          const itemsToInsert = Array.isArray(parsedChunk) ? parsedChunk : [parsedChunk];

          for (const chat of itemsToInsert) {
            const role = chat.role || 'user';
            const content = chat.content || '';
            const subjectId = chat.subject_id || null;
            await databaseService.getDb().runAsync(
              `INSERT INTO ai_chats (id, subject_id, role, content, cloud_url, created_at, is_backed_up)
               VALUES (?, ?, ?, ?, ?, ?, 1)
               ON CONFLICT(id) DO UPDATE SET content = excluded.content, cloud_url = excluded.cloud_url, is_backed_up = 1`,
              [chat.id, subjectId ?? null, role, content, cloudUrl, chat.created_at || new Date().toISOString()]
            );
          }
          result.downloaded += chatsInChunk.length;
        } catch (err) {
          console.error(`[DownloadService] ERROR procesando chunk de chats IA ${cloudUrl}:`, err);
          result.errors += chatsInChunk.length;
        }
      });
    }
  }

  // ── Preferencias de Usuario (JSON chunk) ──
  if (data.userPreferences && data.userPreferences.length > 0) {
    const urlsToDownload = new Set<string>();
    for (const pref of data.userPreferences) {
      if (pref.cloud_url) urlsToDownload.add(pref.cloud_url);
    }

    for (const cloudUrl of urlsToDownload) {
      tasks.push(async () => {
        try {
          const tempUri = `${FileSystem.cacheDirectory}user_prefs_${Date.now()}.json`;
          await FileSystem.downloadAsync(cloudUrl, tempUri);
          const chunkStr = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.UTF8 });
          const parsedChunk = JSON.parse(chunkStr);
          await FileSystem.deleteAsync(tempUri, { idempotent: true });

          const itemsToInsert = Array.isArray(parsedChunk) ? parsedChunk : [parsedChunk];

          for (const pref of itemsToInsert) {
            await databaseService.getDb().runAsync(
              `INSERT INTO user_preferences (key, value, cloud_url, updated_at, is_backed_up)
               VALUES (?, ?, ?, datetime('now'), 1)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value, cloud_url = excluded.cloud_url, is_backed_up = 1, updated_at = excluded.updated_at`,
              [pref.key, pref.value, cloudUrl]
            );
          }
          result.downloaded += itemsToInsert.length;
        } catch (err) {
          console.error(`[DownloadService] ERROR procesando preferencias desde ${cloudUrl}:`, err);
          result.errors += urlsToDownload.size;
        }
      });
    }
  }

  // ── Mazos de Flashcards (JSON con deck + tarjetas) ──
  if (data.flashcardDecks && data.flashcardDecks.length > 0) {
    console.log(`[DownloadService] ${data.flashcardDecks.length} mazo(s) en la nube`);
    for (const item of data.flashcardDecks) {
      tasks.push(async () => {
        if (!item.cloud_url || item.cloud_url === 'ghost_file') {
          console.log(`[DownloadService] Mazo ${item.id} → skip (sin cloud_url o ghost_file)`);
          result.skipped++;
          return;
        }
        try {
          // Descargar el JSON del mazo desde Uploadthing
          console.log(`[DownloadService] Mazo ${item.id}: descargando JSON desde Uploadthing...`);
          const res = await fetch(item.cloud_url);
          if (!res.ok) {
            console.log(`[DownloadService] Mazo ${item.id}: HTTP ${res.status} al descargar JSON → error`);
            result.errors++;
            return;
          }
          const payload = await res.json() as { deck: any; cards: any[]; subject?: any };
          const { deck, cards = [] } = payload;
          if (!deck?.id) {
            console.log(`[DownloadService] Item ${item.id}: payload sin deck.id → skip`);
            result.skipped++;
            return;
          }

          // Verificar si ya existe localmente
          const existing = await databaseService.getDb().getFirstAsync<{ id: string; linked_event_id: string | null }>(
            'SELECT id, linked_event_id FROM flashcard_decks WHERE id = ?', [deck.id]
          );
          if (existing) {
            if (deck.linked_event_id && deck.linked_event_id !== existing.linked_event_id) {
              await databaseService.getDb().runAsync(
                `UPDATE flashcard_decks SET linked_event_id = ?, updated_at = datetime('now') WHERE id = ?`,
                [deck.linked_event_id, deck.id]
              );
              console.log(`[DownloadService] Mazo ${deck.id}: linked_event_id actualizado (${existing.linked_event_id} → ${deck.linked_event_id})`);
            }
            console.log(`[DownloadService] Mazo ${deck.id} ya existe localmente → skip`);
            result.skipped++;
            return;
          }

          // Restaurar subject asociado si viene incluido en el payload
          if (deck.subject_id && payload.subject) {
            try {
              const subjectCols = Object.keys(payload.subject).filter(k => payload.subject[k] !== undefined);
              const subjectVals = subjectCols.map(k => payload.subject[k]);
              const subjectPhs = subjectCols.map(() => '?').join(', ');
              await databaseService.getDb().runAsync(
                `INSERT OR IGNORE INTO subjects (${subjectCols.join(', ')})
                 VALUES (${subjectPhs})`,
                ...subjectVals
              );
            } catch (subjErr) {
              console.warn(`[DownloadService] Mazo ${deck.id}: error al restaurar subject:`, subjErr);
            }
          }

          // UPSERT del mazo con todos sus campos incl. linked_event_id y métricas
          await databaseService.getDb().runAsync(
            `INSERT INTO flashcard_decks
               (id, user_id, subject_id, title, description, linked_event_id,
                avg_ease_factor, total_reviews, last_reviewed_at,
                cloud_url, is_backed_up, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title, description = excluded.description,
               linked_event_id = excluded.linked_event_id,
               avg_ease_factor = excluded.avg_ease_factor,
               total_reviews = excluded.total_reviews,
               last_reviewed_at = excluded.last_reviewed_at,
               cloud_url = excluded.cloud_url, is_backed_up = 1`,
            [
              deck.id, deck.user_id, deck.subject_id ?? null,
              deck.title, deck.description ?? null, deck.linked_event_id ?? null,
              deck.avg_ease_factor ?? null, deck.total_reviews ?? null,
              deck.last_reviewed_at ?? null, item.cloud_url,
              deck.created_at || new Date().toISOString(),
            ]
          );

          // UPSERT de cada tarjeta con métricas SRS completas
          for (const card of cards) {
            if (!card?.id) continue;
            try {
              await databaseService.getDb().runAsync(
                `INSERT INTO flashcards
                   (id, deck_id, front, back, status, direction,
                    ease_factor, interval_days, repetitions, next_review_date,
                    fsrs_stability, fsrs_difficulty, source_context, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   front = excluded.front, back = excluded.back,
                   status = excluded.status, direction = excluded.direction,
                   ease_factor = excluded.ease_factor, interval_days = excluded.interval_days,
                   repetitions = excluded.repetitions, next_review_date = excluded.next_review_date,
                   fsrs_stability = excluded.fsrs_stability, fsrs_difficulty = excluded.fsrs_difficulty,
                   source_context = excluded.source_context`,
                [
                  card.id, deck.id,
                  card.front ?? '', card.back ?? null,
                  card.status ?? 'new', card.direction ?? 'forward',
                  card.ease_factor ?? null, card.interval_days ?? null,
                  card.repetitions ?? 0, card.next_review_date ?? null,
                  card.fsrs_stability ?? null, card.fsrs_difficulty ?? null,
                  card.source_context ?? null,
                  card.created_at || new Date().toISOString(),
                ]
              );
            } catch (cardErr) {
              console.warn(`[DownloadService] Error restaurando tarjeta ${card.id}:`, cardErr);
            }
          }

          console.log(`[DownloadService] Mazo ${deck.id} restaurado con ${cards.length} tarjeta(s).`);
          result.downloaded++;
        } catch (err) {
          console.error(`[DownloadService] ERROR restaurando mazo ${item.id}:`, err);
          result.errors++;
        }
      });
    }
  }

  // Ejecutar con progreso en lotes concurrentes (con límite de 5)
  const total = tasks.length;
  let done = 0;

  console.log(`[DownloadService] Ejecutando ${total} tarea(s) de descarga...`);

  const CONCURRENCY_LIMIT = 5;
  for (let i = 0; i < total; i += CONCURRENCY_LIMIT) {
    const chunk = tasks.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(
      chunk.map(async (task) => {
        await task();
        done++;
        const percent = total > 0 ? Math.round((done / total) * 100) : 100;
        onProgress?.({
          total,
          done,
          current: `${percent}%`,
          errors: result.errors,
          skipped: result.skipped,
        });
      })
    );
    // Ceder el JS Event Loop entre cada lote para que React Native pueda repintar
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  console.log(`[DownloadService] Finalizado: descargadas=${result.downloaded}, saltadas=${result.skipped}, errores=${result.errors}`);
  return result;
};

/**
 * Cuenta cuántos ítems hay en la nube disponibles para descargar.
 */
export const getCloudItemsCount = async (): Promise<number> => {
  try {
    const response = await fetchWithFallback('/backup/cloud-items');
    if (!response.ok) return 0;
    const data = (await parseJsonSafely(response)) as CloudItemsResponse;
    return (
      (data.photos?.length || 0) +
      (data.audio?.length || 0) +
      (data.docs?.length || 0) +
      (data.transcripts?.length || 0) +
      (data.assessmentFiles?.length || 0) +
      (data.flashcardDecks?.length || 0) +
      (data.aiChats?.length || 0)
    );
  } catch {
    return 0;
  }
};
