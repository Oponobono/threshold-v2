import { useState, useEffect, useCallback } from 'react';
import { cacheService } from '../services/cacheService';

/**
 * Hook para cargar datos relacionados del caché en paralelo.
 * Carga galerías, audios, videos y mazos sin bloquear la UI.
 * Ideal para precargar datos en background mientras el dashboard se renderiza.
 */
export const useCachePreload = () => {
  const [isPreloading, setIsPreloading] = useState(false);

  const preloadRelatedData = useCallback(async () => {
    setIsPreloading(true);
    try {
      console.log('[CachePreload] 📦 Pre-cargando datos relacionados del caché...');
      
      // Cargar en paralelo sin bloquear
      await Promise.all([
        cacheService.loadGalleryItems(),
        cacheService.loadAudioRecordings(),
        cacheService.loadYouTubeVideos(),
        cacheService.loadFlashcardDecks(),
        cacheService.loadFlashcardDecksWithMetrics(),
      ]);

      console.log('[CachePreload] ✅ Datos relacionados pre-cargados del caché');
    } catch (error) {
      console.warn('[CachePreload] Error pre-cargando datos:', error);
    } finally {
      setIsPreloading(false);
    }
  }, []);

  return { preloadRelatedData, isPreloading };
};
