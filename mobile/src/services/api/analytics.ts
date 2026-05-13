import { fetchWithFallback, parseJsonSafely, activeBaseUrl } from './client';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface PredictionItem {
  cardId: number;
  question: string;
  subjectId: number;
  mastery: number;
  urgency: 'HIGH' | 'MEDIUM';
}

export interface PredictionResponse {
  dueCount: number;
  cards: PredictionItem[];
}

/**
 * Obtiene las tarjetas de mayor urgencia para revisión predictiva (SM-2)
 */
export const getPredictions = async (userId: string | number): Promise<PredictionResponse> => {
  const response = await fetchWithFallback(`/analytics/predictions/${userId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Error al obtener predicciones');
  const data = await parseJsonSafely(response);
  return data;
};

/**
 * Descarga el informe PDF de dominio del estudiante y lo comparte usando
 * expo-file-system + expo-sharing. Funciona en iOS y Android.
 */
export const downloadReport = async (userId: string | number): Promise<void> => {
  const url = `${activeBaseUrl}/analytics/report/${userId}`;
  
  // Usamos una referencia local para evitar problemas de tipos en ciertas versiones de Expo
  const fs: any = FileSystem;
  const localUri = `${fs.cacheDirectory || ''}informe_dominio_${userId}.pdf`;

  const downloadResult = await fs.downloadAsync(url, localUri, {
    headers: { 'Accept': 'application/pdf' },
  });

  if (downloadResult.status !== 200) {
    throw new Error('Error al descargar el informe del servidor');
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Compartir no está disponible en este dispositivo');

  await Sharing.shareAsync(downloadResult.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Informe de Dominio · Threshold',
    UTI: 'com.adobe.pdf',
  });
};
