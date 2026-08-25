import { RepositoryFactory } from '../services/database/RepositoryFactory';
import { useState, useCallback, useRef } from 'react';

export interface CachePreloadedData {
  galleryItems: any[] | null;
  audioRecordings: any[] | null;
  youTubeVideos: any[] | null;
  flashcardDecks: any[] | null;
  flashcardDecksWithMetrics: any[] | null;
}

// Audit: track concurrent calls globally across all hook instances
let _preloadExecCounter = 0;
let _preloadRunning = false;

/**
 * Hook para cargar datos relacionados de SQLite en paralelo.
 */
export const useCachePreload = () => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [preloadedData, setPreloadedData] = useState<CachePreloadedData | null>(null);
  const instanceId = useRef<number>(++_preloadExecCounter);

  const preloadRelatedData = useCallback(async (): Promise<CachePreloadedData | null> => {
    const execId = ++_preloadExecCounter;
    const wasConcurrent = _preloadRunning;
    _preloadRunning = true;
    const t0 = Date.now();

    if (__DEV__) {
      const stack = new Error().stack?.split('\n').slice(2, 5).join(' ← ') ?? 'unknown';
      console.log(
        `[PRELOAD] #${execId} instance=${instanceId.current} concurrent=${wasConcurrent} t=${Date.now()}ms\n  caller: ${stack}`
      );
    }

    setIsPreloading(true);
    try {
      const [galleryItems, audioRecordings, youTubeVideos, flashcardDecks] = await Promise.all([
        RepositoryFactory.photos().getMetadata().catch(() => []),   // lightweight: excludes ocr_text
        RepositoryFactory.audio().getAll().catch(() => []),
        RepositoryFactory.youtube().getAll().catch(() => []),
        RepositoryFactory.flashcardDecks().getAll().catch(() => []),
      ]);

      if (__DEV__) {
        const totalRows = (galleryItems as any[]).length + (audioRecordings as any[]).length + (youTubeVideos as any[]).length + (flashcardDecks as any[]).length;
        console.log(`[PRELOAD] #${execId} done | duration=${Date.now() - t0}ms | totalRows=${totalRows} | photos=${(galleryItems as any[]).length} audio=${(audioRecordings as any[]).length} yt=${(youTubeVideos as any[]).length} decks=${(flashcardDecks as any[]).length}`);
      }

      const result: CachePreloadedData = {
        galleryItems: galleryItems.length > 0 ? galleryItems as any[] : null,
        audioRecordings: audioRecordings.length > 0 ? audioRecordings as any[] : null,
        youTubeVideos: youTubeVideos.length > 0 ? youTubeVideos as any[] : null,
        flashcardDecks: flashcardDecks.length > 0 ? flashcardDecks as any[] : null,
        flashcardDecksWithMetrics: flashcardDecks.length > 0 ? flashcardDecks as any[] : null,
      };

      setPreloadedData(result);
      return result;
    } catch (error) {
      console.warn('[CachePreload] Error pre-cargando datos:', error);
      return null;
    } finally {
      _preloadRunning = false;
      setIsPreloading(false);
    }
  }, []);

  return { preloadRelatedData, isPreloading, preloadedData };
};

