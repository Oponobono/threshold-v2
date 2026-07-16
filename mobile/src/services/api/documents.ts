import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { documentRepository, syncService } from '../database';
import { requireActiveSubject, requireActiveDocument } from '../domain/invariants';
import { extractTextFromPdfLocal } from '../localPDFService';
import { getBackupPreferences } from '../backup/backupService';
import { assetSyncEngine } from '../sync/asset/AssetSyncEngine';
import { uuidv4 } from '../../utils/uuid';

export interface ScannedDocument {
  id?: string;
  user_id?: string;
  subject_id?: string;
  name?: string;
  local_uri?: string;
  ocr_text?: string;
  mime_type?: string;
  created_at?: string;
}

function extFromMime(mime: string, fallbackName?: string): string {
  const ext = fallbackName?.split('.').pop();
  if (ext && ext.length <= 5 && ext !== fallbackName) return `.${ext}`;
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/json': '.json',
    'text/plain': '.txt',
    'text/csv': '.csv',
  };
  return map[mime] ?? '.bin';
}

export const getScannedDocumentsBySubject = async (subjectId: string): Promise<ScannedDocument[]> => {
  // Retornar datos locales inmediatamente
  const localData = await documentRepository.getBySubject(subjectId);

  // Sincronizar desde la nube en background solo si auto-upload activo
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) return;
      const response = await fetchWithFallback(`/scanned_documents/subject/${subjectId}`);
      const data = await parseJsonSafely(response);
      if (response.ok && Array.isArray(data)) {
        for (const d of data) await documentRepository.upsertFromCloud(d);
      }
    } catch {}
  })();

  return localData;
};

export const createScannedDocument = async (data: { subject_id?: string; name?: string; local_uri: string; ocr_text?: string; id?: string; mime_type?: string }): Promise<ScannedDocument> => {
  const id = data.id || uuidv4();
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  if (data.subject_id) {
    await requireActiveSubject(data.subject_id);
  }

  // 1. Guardar SIEMPRE en SQLite local primero — los documentos funcionan sin red
  const doc: any = { id, user_id: String(userId), ...data };
  await documentRepository.create(doc);

  const mimeType = data.mime_type ?? 'application/pdf';
  const fileExt = extFromMime(mimeType, data.name);
  assetSyncEngine.scheduleUpload('scanned-document', id, data.local_uri, mimeType, `${id}${fileExt}`);

  // 2. Sincronizar con la nube SOLO si el usuario habilitó auto-upload (background, no bloqueante)
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload || !prefs?.includeDocs) return;

      const response = await fetchWithFallback('/scanned_documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id, user_id: userId }),
      });
      const responseData = await parseJsonSafely(response);
      if (response.ok) {
        await documentRepository.update(responseData.id, responseData);
      } else {
        throw new Error(responseData?.error || 'Error del servidor');
      }
    } catch {
      await syncService.enqueueCreate('scanned-document', id, { ...data, user_id: userId });
    }
  })();

  return doc;
};

export const deleteScannedDocument = async (documentId: string) => {
  // 1. Borrar localmente de forma inmediata
  await documentRepository.delete(documentId);

  // 2. Sincronizar la eliminación en background
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) {
        await syncService.enqueueDelete('scanned-document', documentId);
        return;
      }
      const response = await fetchWithFallback(`/scanned_documents/${documentId}`, { method: 'DELETE' });
      if (!response.ok) {
        await syncService.enqueueDelete('scanned-document', documentId);
      }
    } catch {
      await syncService.enqueueDelete('scanned-document', documentId);
    }
  })();

  return { success: true };
};

export const updateScannedDocument = async (documentId: string, data: Partial<ScannedDocument>): Promise<any> => {
  await requireActiveDocument(documentId);

  // 1. Actualizar localmente de forma inmediata
  await documentRepository.update(documentId, data as any);

  // 2. Sincronizar en background si auto-upload activo
  (async () => {
    try {
      const prefs = await getBackupPreferences();
      if (!prefs?.enabled || !prefs?.autoUpload) {
        await syncService.enqueueUpdate('scanned-document', documentId, data);
        return;
      }
      const response = await fetchWithFallback(`/scanned_documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await syncService.enqueueUpdate('scanned-document', documentId, data);
      }
    } catch {
      await syncService.enqueueUpdate('scanned-document', documentId, data);
    }
  })();

  return { ...data };
};

export const extractTextFromImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await fetchWithFallback('/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      const errField = data?.error;
      const errMsg = typeof errField === 'string' ? errField : errField?.message ?? JSON.stringify(errField) ?? 'Error al procesar el OCR';
      throw new Error(errMsg);
    }
    return data?.text || '';
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al invocar el servicio de OCR');
  }
};

export const extractTextFromPDF = async (base64Pdf: string): Promise<string> => {
  try {
    const response = await fetchWithFallback('/pdf-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Pdf }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      const errMsg = typeof data?.error === 'string' ? data.error : 'Error al parsear el PDF';
      throw new Error(errMsg);
    }
    return data?.text || '';
  } catch (error: any) {
    console.warn('[PDF Extract] Falló backend, intentando extracción local offline...', error);
    try {
      const localText = await extractTextFromPdfLocal(base64Pdf);
      if (localText && localText.trim().length > 0) return localText;
    } catch {}
    throw new Error(error.message || 'Error de red al invocar el servicio de extracción PDF');
  }
};

/**
 * Envía un archivo de presentación (PPTX/PPT) al backend y recibe el PDF convertido.
 * @param localUri  Ruta local del archivo de presentación.
 * @param mimeType  MIME type del archivo.
 * @returns         ArrayBuffer con el contenido del PDF resultante.
 */
export const convertPresentationToPdf = async (
  localUri: string,
  mimeType: string,
): Promise<ArrayBuffer> => {
  const FileSystem = require('expo-file-system/legacy');
  const { getApiBaseUrl } = require('./client');
  const { getToken } = require('./auth');

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Convertir base64 → Uint8Array para construir el FormData
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const fileName = localUri.split('/').pop() || 'presentation.pptx';
  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    type: mimeType,
    name: fileName,
  } as any);

  const baseUrl = await getApiBaseUrl();
  const token = await getToken();

  const response = await fetch(`${baseUrl}/api/convert/presentation`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const code = (errData as any)?.code;
    if (code === 'LIBREOFFICE_UNAVAILABLE') {
      throw new Error('LIBREOFFICE_UNAVAILABLE');
    }
    throw new Error((errData as any)?.error || `HTTP ${response.status}`);
  }

  return await response.arrayBuffer();
};

