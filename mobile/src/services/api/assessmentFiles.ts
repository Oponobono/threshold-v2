import { fetchWithFallback, parseJsonSafely } from './client';
import { assessmentFileRepository, syncService } from '../database';
import { uuidv4 } from '../../utils/uuid';
import * as FileSystem from 'expo-file-system/legacy';

export interface AssessmentFile {
  id: string;
  assessment_id: string;
  file_name: string;
  file_type?: string;
  local_uri?: string;
  cloud_url?: string;
  file_size?: number;
  is_backed_up?: boolean | number;
  created_at?: string;
}

/**
 * Upload a file to an assessment
 * Offline-first: creates locally and enqueues sync
 */
export const uploadAssessmentFile = async (
  assessmentId: string,
  file: {
    file_name: string;
    file_type?: string;
    local_uri?: string;
    file_size?: number;
  }
): Promise<AssessmentFile> => {
  const fileId = uuidv4();
  
  // Create permanent local copy
  let permanentUri = file.local_uri;
  if (file.local_uri && !file.local_uri.includes(FileSystem.documentDirectory || '')) {
    try {
      const ext = file.file_name.split('.').pop();
      const newUri = `${FileSystem.documentDirectory}assessment_files_${fileId}.${ext}`;
      await FileSystem.copyAsync({ from: file.local_uri, to: newUri });
      permanentUri = newUri;
    } catch (err) {
      console.warn('Could not copy assessment file to permanent directory:', err);
    }
  }

  const localFile: AssessmentFile = {
    id: fileId,
    assessment_id: assessmentId,
    file_name: file.file_name,
    file_type: file.file_type || 'application/octet-stream',
    local_uri: permanentUri,
    file_size: file.file_size || 0,
    is_backed_up: 0,
    created_at: new Date().toISOString()
  };

  // Guardar en SQLite
  await assessmentFileRepository.create(localFile);

  // Encolar para subida en background
  await syncService.enqueueCreate('assessment_files', localFile.id, localFile);

  // Intentar la subida inmediatamente si hay red
  syncService.sync().catch(() => {});

  return localFile;
};

/**
 * Get all files for an assessment
 * Offline-first: lee localmente, sincroniza en background
 */
export const getAssessmentFiles = async (assessmentId: string): Promise<AssessmentFile[]> => {
  // 1. Mostrar lo que tenemos localmente de inmediato (UI optimista)
  const localFiles = await assessmentFileRepository.getByAssessment(assessmentId);

  // 2. Intentar traer actualizaciones del backend
  fetchWithFallback(`/assessments/${assessmentId}/files`, { method: 'GET' })
    .then(async (response) => {
      if (!response.ok) return;
      const serverFiles = await parseJsonSafely(response);
      if (Array.isArray(serverFiles)) {
        for (const sf of serverFiles) {
          const existing = localFiles.find(lf => lf.id === sf.id);
          if (!existing) {
            await assessmentFileRepository.create({
              ...sf,
              is_backed_up: 1
            });
          }
        }
      }
    })
    .catch(() => {
      // Ignorar el error de red, ya tenemos los datos locales
    });

  return localFiles;
};

/**
 * Delete a file from an assessment
 * Offline-first: elimina localmente y encola borrado
 */
export const deleteAssessmentFile = async (assessmentId: string, fileId: string): Promise<void> => {
  // Borrar de la DB local primero
  await assessmentFileRepository.delete(fileId);

  // Encolar el borrado
  await syncService.enqueueDelete('assessment_files', fileId);

  // Intentar borrar en backend si hay red
  syncService.sync().catch(() => {});
};
