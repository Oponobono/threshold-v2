import { useState, useCallback } from 'react';
import { cacheService } from '../services/cacheService';

export interface CachePreloadedData {
  galleryItems: any[] | null;
  audioRecordings: any[] | null;
  youTubeVideos: any[] | null;
  flashcardDecks: any[] | null;
  flashcardDecksWithMetrics: any[] | null;
}

/**
 * Hook para cargar datos relacionados del caché en paralelo.
 * Carga galerías, audios, videos y mazos sin bloquear la UI.
 * Ideal para precargar datos en background mientras el dashboard se renderiza.
 */
export const useCachePreload = () => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedData, setPreloadedData] = useState<CachePreloadedData | null>(null);

  const preloadRelatedData = useCallback(async (): Promise<CachePreloadedData | null> => {
    setIsPreloading(true);
    try {
      console.log('[CachePreload] 📦 Pre-cargando datos relacionados del caché...');

      const loaded = await Promise.all([
        cacheService.loadGalleryItems(),
        cacheService.loadAudioRecordings(),
        cacheService.loadYouTubeVideos(),
        cacheService.loadFlashcardDecks(),
        cacheService.loadFlashcardDecksWithMetrics(),
      ]);
      const galleryItems = loaded[0] as any[] | null;
      const audioRecordings = loaded[1] as any[] | null;
      const youTubeVideos = loaded[2] as any[] | null;
      const flashcardDecks = loaded[3] as any[] | null;
      const flashcardDecksWithMetrics = loaded[4] as any[] | null;

      const result: CachePreloadedData = {
        galleryItems,
        audioRecordings,
        youTubeVideos,
        flashcardDecks,
        flashcardDecksWithMetrics,
      };

      setPreloadedData(result);
      console.log('[CachePreload] ✅ Datos relacionados pre-cargados del caché');
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
