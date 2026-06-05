/**
 * Uploadthing Storage Service (Mobile)
 * 
 * La app envía el archivo al backend de Threshold vía FormData.
 * El backend lo sube a Uploadthing usando UTApi y devuelve la URL permanente.
 * Este enfoque evita la necesidad de un SDK de Uploadthing para React Native.
 */
import { storageService } from '../storageService';

const getApiUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
};

export type UploadEndpoint = 'profileImage' | 'galleryPhoto' | 'audioRecording' | 'document';

export interface UploadResult {
  url: string;
  key: string;
  name: string;
  size: number;
}

/**
 * Sube un archivo local al backend de Threshold, que lo proxy-ea a Uploadthing.
 * @param localUri - URI local del archivo (ej: result.assets[0].uri)
 * @param filename - Nombre del archivo
 * @param mimeType - MIME type (ej: 'image/jpeg')
 * @returns Objeto con la URL permanente del archivo en Uploadthing
 */
export const uploadFileToUploadthing = async (
  localUri: string,
  filename?: string,
  mimeType?: string
): Promise<UploadResult> => {
  const token = await storageService.getSecure('jwt_token');
  if (!token) throw new Error('No hay sesión activa.');

  const resolvedMime = mimeType || inferMimeType(localUri);
  const resolvedName = filename || `upload_${Date.now()}.${localUri.split('.').pop() || 'bin'}`;

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    name: resolvedName,
    type: resolvedMime,
  });

  console.log(`[Uploadthing] Subiendo archivo al servidor: ${getApiUrl()}/upload`);
  console.log(`[Uploadthing] Datos: uri=${localUri}, name=${resolvedName}, type=${resolvedMime}`);
  
  const response = await fetch(`${getApiUrl()}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // NO pongas Content-Type aquí: fetch lo establece automáticamente con el boundary correcto
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(`[Uploadthing] ERROR HTTP ${response.status}:`, error);
    throw new Error(error?.error || 'Error al subir el archivo.');
  }

  const data = await response.json();
  console.log(`[Uploadthing] ÉXITO: Respuesta del servidor:`, data);
  return data;
};

/**
 * Elimina un archivo de Uploadthing por su key.
 * Útil cuando el usuario reemplaza su foto de perfil.
 */
export const deleteUploadthingFile = async (key: string): Promise<void> => {
  const token = await storageService.getSecure('jwt_token');
  if (!token) return;

  await fetch(`${getApiUrl()}/upload/${key}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {}); // Silencioso — no es crítico si falla
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function inferMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };
  return map[ext || ''] || 'application/octet-stream';
}
