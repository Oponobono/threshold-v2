/**
 * aiContextMappers.ts
 *
 * Utilidades para mapear entidades del dominio (grabaciones, fotos, documentos, videos)
 * al formato unificado `AIContextItemData`. Este formato es consumido por los componentes
 * visuales (`AIContextCarousel`, `SubjectAIChatModal`) para representar los elementos
 * adjuntos al contexto del chat con la IA.
 */
import { AIContextItemData, AIContextItemType } from '../components/ai/AIContextItem';
import { RecordingItem } from '../hooks/useAudioRecorder';
import { YouTubeVideo } from '../services/api/types';
import i18n from '../locales/i18n';

/** Mapea grabaciones de audio — hasText=true si existe transcript_uri o transcript_text */
export function mapRecordings(recordings: RecordingItem[]): AIContextItemData[] {
  return recordings.map((r, i) => ({
    id: `rec_${r.id_string || r.id || i}`,
    label: r.name || i18n.t('recordings.defaultName'),
    uri: r.uri || r.local_uri,
    type: 'recording' as AIContextItemType,
    hasText: !!(
      (r.transcript_uri && r.transcript_uri.length > 0) ||
      (r.transcript_text && r.transcript_text.length > 0)
    ),
    searchText: r.transcript_text || '',
    rawItem: r,
  }));
}

/** Mapea fotos — hasText=true solo si la foto tiene ocr_text en la BD */
export function mapPhotos(photos: any[]): AIContextItemData[] {
  return photos.map((p, i) => ({
    id: `photo_${p.id ?? i}`,
    label: (p.local_uri || '').split('/').pop() || 'Foto',
    uri: p.local_uri,
    type: 'photo' as AIContextItemType,
    hasText: !!(p.ocr_text && p.ocr_text.length > 0),
    searchText: p.ocr_text || '',
    rawItem: p,
  }));
}

/**
 * Mapea documentos para contexto de IA.
 *
 * ocr_text almacena el índice documental del documento. Puede provenir de
 * extracción nativa (PDF, XLSX, PPTX, TXT) o de OCR (imágenes, PDFs escaneados).
 * El nombre se conserva por compatibilidad con versiones anteriores.
 *
 * hasText=true si existe contenido textual indexable.
 */
export function mapDocuments(documents: any[]): AIContextItemData[] {
  return documents.map((d, i) => ({
    id: `doc_${d.id ?? i}`,
    label: d.name || (d.local_uri || '').split('/').pop() || 'Documento',
    uri: d.local_uri,
    type: 'document' as AIContextItemType,
    hasText: !!(d.ocr_text && d.ocr_text.length > 0),
    searchText: d.ocr_text || '',
    rawItem: d,
  }));
}

/** Mapea videos de YouTube — hasText=true si existe transcript_uri o transcript_text */
export function mapVideos(videos: YouTubeVideo[]): AIContextItemData[] {
  return videos.map((v, i) => ({
    id: `vid_${v.id ?? i}`,
    label: v.title || 'Video de YouTube',
    thumbnailUrl: v.thumbnail_url || undefined,
    type: 'video' as AIContextItemType,
    hasText: !!(
      (v.transcript_uri && v.transcript_uri.length > 0) ||
      (v.transcript_text && v.transcript_text.length > 0)
    ),
    searchText: v.transcript_text || '',
    rawItem: v,
  }));
}
