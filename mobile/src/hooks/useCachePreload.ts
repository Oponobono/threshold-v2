import { useState, useCallback } from 'react';
import type { Photo, AudioRecording, YouTubeVideo, FlashcardDeck } from '../services/api/types';
import { photoRepository, audioRepository, youTubeRepository, flashcardDeckRepository } from '../services/database';

export interface CachePreloadedData {
  galleryItems: Photo[] | null;
  audioRecordings: AudioRecording[] | null;
  youTubeVideos: YouTubeVideo[] | null;
  flashcardDecks: FlashcardDeck[] | null;
  flashcardDecksWithMetrics: FlashcardDeck[] | null;
}

/**
 * Hook para cargar datos relacionados de SQLite en paralelo.
 */
export const useCachePreload = () => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedData, setPreloadedData] = useState<CachePreloadedData | null>(null);

  const preloadRelatedData = useCallback(async (): Promise<CachePreloadedData | null> => {
    setIsPreloading(true);
    try {
      console.log('[CachePreload] 📦 Pre-cargando datos relacionados de SQLite...');

      const [galleryItems, audioRecordings, youTubeVideos, flashcardDecks] = await Promise.all([
        photoRepository.getAll().catch(() => []),
        audioRepository.getAll().catch(() => []),
        youTubeRepository.getAll().catch(() => []),
        flashcardDeckRepository.getAll().catch(() => []),
      ]);

      const result: CachePreloadedData = {
        galleryItems: galleryItems.length > 0 ? galleryItems as Photo[] : null,
        audioRecordings: audioRecordings.length > 0 ? audioRecordings as AudioRecording[] : null,
        youTubeVideos: youTubeVideos.length > 0 ? youTubeVideos as YouTubeVideo[] : null,
        flashcardDecks: flashcardDecks.length > 0 ? flashcardDecks as FlashcardDeck[] : null,
        flashcardDecksWithMetrics: flashcardDecks.length > 0 ? flashcardDecks as FlashcardDeck[] : null,
      };

      setPreloadedData(result);
      console.log('[CachePreload] ✅ Datos relacionados pre-cargados de SQLite');
      return result;
    } catch (error) {
      console.warn('[CachePreload] Error pre-cargando datos:', error);
      return null;
    } finally {
      setIsPreloading(false);
    }
  }, []);

  return { preloadRelatedData, isPreloading, preloadedData };
};
