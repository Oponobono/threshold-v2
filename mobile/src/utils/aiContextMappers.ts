/**
 * aiContextMappers.ts
 *
 * Utilidades para mapear entidades del dominio (grabaciones, fotos, documentos, videos)
 * al formato unificado `AIContextItemData`. Este formato es consumido por los componentes
 * visuales (`AIContextCarousel`, `SubjectAIChatModal`) para representar los elementos
 * adjuntos al contexto del chat con la IA.
 */
import { AIContextItemData, AIContextItemType } from '../components/AIContextItem';
import { RecordingItem } from '../hooks/useAudioRecorder';
import { YouTubeVideo } from '../services/api/types';

/** Mapea un arreglo de grabaciones de audio a ítems de contexto IA */
export function mapRecordings(recordings: RecordingItem[]): AIContextItemData[] {
  return recordings.map((r, i) => ({
    id: `rec_${r.id_string || r.id || i}`,
    label: r.name || 'Grabación de voz',
    uri: r.uri || r.local_uri,
    type: 'recording' as AIContextItemType,
    rawItem: r,
  }));
}

/** Mapea un arreglo de fotos de la galería a ítems de contexto IA */
export function mapPhotos(photos: any[]): AIContextItemData[] {
  return photos.map((p, i) => ({
    id: `photo_${p.id ?? i}`,
    label: (p.local_uri || '').split('/').pop() || 'Foto',
    uri: p.local_uri,
    type: 'photo' as AIContextItemType,
    rawItem: p,
  }));
}

/** Mapea un arreglo de documentos escaneados a ítems de contexto IA */
export function mapDocuments(documents: any[]): AIContextItemData[] {
  return documents.map((d, i) => ({
    id: `doc_${d.id ?? i}`,
    label: d.name || (d.local_uri || '').split('/').pop() || 'Documento',
    uri: d.local_uri,
    type: 'document' as AIContextItemType,
    rawItem: d,
  }));
}

/** Mapea un arreglo de videos de YouTube a ítems de contexto IA */
export function mapVideos(videos: YouTubeVideo[]): AIContextItemData[] {
  return videos.map((v, i) => ({
    id: `vid_${v.id ?? i}`,
    label: v.title || 'Video de YouTube',
    thumbnailUrl: v.thumbnail_url || undefined,
    type: 'video' as AIContextItemType,
    rawItem: v,
  }));
}
