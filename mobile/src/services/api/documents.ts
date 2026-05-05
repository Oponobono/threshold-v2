/**
 * documents.ts
 *
 * Servicio CRUD para documentos escaneados y extracción de texto por OCR.
 * Los documentos se generan con `DocumentScannerModal` y pueden exportarse como
 * imagen JPEG o PDF. El endpoint `/ocr` utiliza Groq Vision para extraer texto
 * del documento y retornarlo como string plano para compartir o procesar con IA.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';

/** Representa un documento escaneado vinculado a una materia y guardado localmente */
export interface ScannedDocument {
  id?: number;
  user_id?: number;
  subject_id?: number | null;
  name?: string | null;
  local_uri: string;
  /** Texto extraído por OCR — alimenta el contexto del asistente IA */
  ocr_text?: string | null;
  created_at?: string;
}

/** Obtiene todos los documentos escaneados de una materia específica */
export const getScannedDocumentsBySubject = async (subjectId: number | string): Promise<ScannedDocument[]> => {
  try {
    const response = await fetchWithFallback(`/scanned_documents/subject/${subjectId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      console.warn('[getScannedDocumentsBySubject] Error:', data?.error);
      return [];
    }
    return data || [];
  } catch (error: any) {
    console.warn('[getScannedDocumentsBySubject] Network error:', error.message);
    return [];
  }
};

/** Guarda un documento escaneado en el servidor. Inyecta automáticamente el `user_id` */
export const createScannedDocument = async (
  data: Omit<ScannedDocument, 'id' | 'created_at' | 'user_id'>
): Promise<ScannedDocument> => {
  try {
    const userId = await getUserId();
    if (!userId) throw new Error('Usuario no autenticado');

    // Enviar ocr_text junto a la URI para que la IA tenga contexto inmediato
    const response = await fetchWithFallback('/scanned_documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, user_id: userId }),
    });
    
    const responseData = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(responseData?.error || 'Error al guardar el documento escaneado');
    }
    return responseData;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al crear el documento escaneado');
  }
};

/** Elimina un documento escaneado de la base de datos por su ID */
export const deleteScannedDocument = async (documentId: number | string): Promise<any> => {
  try {
    const response = await fetchWithFallback(`/scanned_documents/${documentId}`, {
      method: 'DELETE',
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al eliminar el documento escaneado');
    }
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar eliminar el documento escaneado');
  }
};

/**
 * Extrae texto de una imagen usando Groq Vision (OCR on-cloud).
 * La imagen debe enviarse como base64. El tamaño máximo recomendado es ~3.5 MB.
 * @param base64Image - Imagen codificada en base64 (sin prefijo `data:image/...`).
 * @returns Texto plano extraído de la imagen.
 */
export const extractTextFromImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await fetchWithFallback('/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      // El error puede ser string u objeto { message, type, code }
      const errField = data?.error;
      const errMsg =
        typeof errField === 'string'
          ? errField
          : errField?.message ?? JSON.stringify(errField) ?? 'Error al procesar el OCR';
      console.error('[OCR] Backend error:', errMsg, '| Status:', response.status);
      throw new Error(errMsg);
    }
    return data?.text || '';
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al invocar el servicio de OCR');
  }
};
