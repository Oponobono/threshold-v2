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
import { File, Directory, Paths } from 'expo-file-system';
import { fetchWithFallback, parseJsonSafely } from '../api/client';
import { getBackupPreferences } from './backupService';

// ─── Directorios de descarga ─────────────────────────────────────────────────

/** Obtiene (y crea si no existe) un subdirectorio dentro de documentDirectory */
const getDownloadSubdir = (subdir: string): Directory => {
  const dir = new Directory(Paths.document, 'threshold_cloud', subdir);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
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
  const tasks: (() => Promise<void>)[] = [];

  // ── Fotos ──
  if (prefs.includePhotos) {
    const photosDir = getDownloadSubdir('photos');
    for (const item of data.photos || []) {
      tasks.push(async () => {
        const ext = item.cloud_url.split('.').pop()?.split('?')[0] || 'jpg';
        const filename = (item.name || `photo_${item.id}`).replace(/\.[^.]+$/, '') + `.${ext}`;
        const destFile = new File(photosDir, filename);
        if (destFile.exists) { result.skipped++; return; }
        try {
          await File.downloadFileAsync(item.cloud_url, photosDir);
          result.downloaded++;
        } catch { result.errors++; }
      });
    }
  }

  // ── Audio ──
  if (prefs.includeAudio) {
    const audioDir = getDownloadSubdir('audio');
    for (const item of data.audio || []) {
      tasks.push(async () => {
        const ext = item.cloud_url.split('.').pop()?.split('?')[0] || 'm4a';
        const filename = (item.name || `audio_${item.id}`).replace(/\.[^.]+$/, '') + `.${ext}`;
        const destFile = new File(audioDir, filename);
        if (destFile.exists) { result.skipped++; return; }
        try {
          await File.downloadFileAsync(item.cloud_url, audioDir);
          result.downloaded++;
        } catch { result.errors++; }
      });
    }
  }

  // ── Documentos ──
  if (prefs.includeDocs) {
    const docsDir = getDownloadSubdir('docs');
    for (const item of data.docs || []) {
      tasks.push(async () => {
        const ext = item.cloud_url.split('.').pop()?.split('?')[0] || 'pdf';
        const filename = (item.name || `doc_${item.id}`).replace(/\.[^.]+$/, '') + `.${ext}`;
        const destFile = new File(docsDir, filename);
        if (destFile.exists) { result.skipped++; return; }
        try {
          await File.downloadFileAsync(item.cloud_url, docsDir);
          result.downloaded++;
        } catch { result.errors++; }
      });
    }
  }

  // ── Transcripciones ──
  if (prefs.includeTranscripts) {
    const transcriptsDir = getDownloadSubdir('transcripts');
    for (const item of data.transcripts || []) {
      tasks.push(async () => {
        const filename = `transcript_${item.transcript_type}_${item.id}.txt`;
        const destFile = new File(transcriptsDir, filename);
        if (destFile.exists) { result.skipped++; return; }
        try {
          if (item.transcript_text) {
            // Escribir texto directamente (no necesita descargar de Uploadthing)
            destFile.write(item.transcript_text);
            result.downloaded++;
          } else if (item.cloud_url) {
            await File.downloadFileAsync(item.cloud_url, transcriptsDir);
            result.downloaded++;
          }
        } catch { result.errors++; }
      });
    }
  }

  // Ejecutar con progreso
  const total = tasks.length;
  let done = 0;

  for (const task of tasks) {
    await task();
    done++;
    onProgress?.({
      total,
      done,
      current: `${done}/${total}`,
      errors: result.errors,
      skipped: result.skipped,
    });
  }

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
      (data.transcripts?.length || 0)
    );
  } catch {
    return 0;
  }
};
