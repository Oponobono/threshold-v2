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
    const transcriptsDir = await getDownloadSubdirUri('transcripts');
    for (const item of data.transcripts || []) {
      tasks.push(async () => {
        const filename = `transcript_${item.transcript_type}_${item.id}.txt`;
        // Sanitizar el nombre para evitar slashes u otros caracteres que rompen la ruta
        const safeFilename = filename.replace(/[/\\:*?"<>|]/g, '_');
        const localUri = `${transcriptsDir}${safeFilename}`;

        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) { result.skipped++; return; }
        if (item.cloud_url === 'ghost_file') { result.skipped++; return; }

        try {
          if (item.transcript_text) {
            await FileSystem.writeAsStringAsync(localUri, item.transcript_text);
            result.downloaded++;
          } else if (item.cloud_url) {
            console.log(`[DownloadService] Descargando Transcripción: ${item.cloud_url} -> ${localUri}`);
            await FileSystem.downloadAsync(item.cloud_url, localUri);
            result.downloaded++;
          }
        } catch (err) { 
          console.error(`[DownloadService] ERROR descargando transcripción ${item.id}:`, err);
          result.errors++; 
        }
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
