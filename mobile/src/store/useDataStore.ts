import { create } from 'zustand';
import { 
  Subject, Assessment, Schedule, 
  getSubjects, getAllAssessments, getAllSchedules, 
  getPredictions, PredictionResponse,
  getGalleryItems, getPhotosBySubject,
  getAudioRecordings,
  getFlashcardDecks, getFlashcardDecksWithMetrics, getFlashcards, getFlashcardsPrioritized, getCardsNotSnoozed,
  getScannedDocumentsBySubject,
  fetchWithFallback,
} from '../services/api';
import { loadPredictionsFromCache, savePredictionsToCache } from '../hooks/usePredictionPolling';
import { cacheService } from '../services/cacheService';
import { offlineSyncService } from '../services/offlineSyncService';
import { useConnectivityStore } from './useConnectivityStore';

interface DataState {
  // Datos
  subjects: Subject[];
  assessments: Assessment[];
  schedules: Schedule[];
  predictions: PredictionResponse | null;

  // Estado de carga
  isInitialLoading: boolean;
  isRefreshing: boolean;
  hasLoadedOnce: boolean;
  /** Indica si hay una sincronización de datos en curso */
  isSyncing: boolean;
  /** Mensaje descriptivo del estado actual de sincronización */
  syncStatusMessage: string;

  // Acciones (Mutadores globales)
  loadAllData: (forceRefresh?: boolean) => Promise<void>;
  loadCachedDataOnly: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshPredictions: (userId: string | number) => Promise<void>;
  loadCachedPredictions: () => Promise<void>;
  preloadOfflineCache: () => Promise<void>;
  syncPendingOperations: () => Promise<{ success: number; failed: number; pending: number }>;
  
  // Selectores
  getDuedeckIds: () => Set<number>;
}

// Intenta leer del caché síncrono de MMKV. Si el módulo nativo no está listo
// todavía (primer arranque en frío), cae en el valor por defecto sin crashear.
const trySync = <T>(fn: () => T | null, fallback: T): T => {
  try { return fn() ?? fallback; } catch (_e) { return fallback; }
};

export const useDataStore = create<DataState>((set, get) => ({
  // ═══════════════════════════════════════════════════════════════
  // 📦 Datos: hidratados instantáneamente desde MMKV (stale ok)
  // ═══════════════════════════════════════════════════════════════
  subjects: trySync(() => cacheService.loadSubjectsSync(), []) as any[],
  assessments: trySync(() => cacheService.loadAssessmentsSync(), []) as any[],
  schedules: trySync(() => cacheService.loadSchedulesSync(), []) as any[],
  predictions: trySync<PredictionResponse | null>(() => cacheService.loadPredictionsSync() as PredictionResponse | null, null),

  isInitialLoading: false,
  isRefreshing: false,
  // false para que loadAllData contacte al servidor en el primer uso.
  // La UI ya tiene datos instantáneos gracias a MMKV (líneas 47-50).
  hasLoadedOnce: false,
  isSyncing: false,
  syncStatusMessage: '',

  // ═══════════════════════════════════════════════════════════════
  // 🔄 loadAllData: Estrategia "stale-while-revalidate"
  //   1. Cache primero (ya hidratado por MMKV) — instantáneo
  //   2. Si hay red, refrescar desde servidor en background
  //   3. Si no hay red, mantener datos del caché (aunque estén stale)
  // ═══════════════════════════════════════════════════════════════
  loadAllData: async (forceRefresh = false) => {
    const state = get();
    if (state.isInitialLoading || state.isRefreshing) return;
    if (state.hasLoadedOnce && !forceRefresh) return;

    // Verificar conectividad actual
    const connectivityState = useConnectivityStore.getState();
    const isOnline = connectivityState.isOnline;

    if (!state.hasLoadedOnce) {
      set({ isInitialLoading: true });
    } else {
      set({ isRefreshing: true });
    }

    // Si no hay conexión, saltar la fase de servidor
    // Los datos del caché (via MMKV) ya están disponibles en el store
    if (!isOnline) {
      console.log('[DataStore] 📡 Modo offline: usando datos del caché (stale-while-revalidate)');
      set({
        hasLoadedOnce: true,
        isInitialLoading: false,
        isRefreshing: false,
        isSyncing: false,
        syncStatusMessage: '',
      });
      return;
    }

    // 🌐 Hay conexión: mostrar indicador de sincronización y refrescar
    set({ isSyncing: true, syncStatusMessage: 'Sincronizando datos...' });
    useConnectivityStore.getState().setSyncing(true);

    try {
      console.log('[DataStore] 🔄 Actualizando desde servidor...');
      const [subjectsData, assessmentsData, schedulesData] = await Promise.all([
        getSubjects().catch((err) => {
          console.warn('[DataStore] Error obteniendo subjects:', err);
          return null;
        }),
        getAllAssessments().catch((err) => {
          console.warn('[DataStore] Error obteniendo assessments:', err);
          return null;
        }),
        getAllSchedules().catch((err) => {
          console.warn('[DataStore] Error obteniendo schedules:', err);
          return null;
        })
      ]);

      // Solo actualizar si hay datos válidos del servidor
      // Si algo falla, mantener los datos existentes del caché
      const updatedState: any = { hasLoadedOnce: true };
      let anyDataUpdated = false;
      
      if (subjectsData !== null) {
        updatedState.subjects = subjectsData;
        anyDataUpdated = true;
      }
      if (assessmentsData !== null) {
        updatedState.assessments = assessmentsData;
        anyDataUpdated = true;
      }
      if (schedulesData !== null) {
        updatedState.schedules = schedulesData;
        anyDataUpdated = true;
      }

      set(updatedState);

      // 💾 Guardar en caché solo lo que se obtuvo exitosamente
      if (subjectsData !== null) {
        await cacheService.saveSubjects(subjectsData);
      }
      if (assessmentsData !== null) {
        await cacheService.saveAssessments(assessmentsData);
      }
      if (schedulesData !== null) {
        await cacheService.saveSchedules(schedulesData);
      }

      if (anyDataUpdated) {
        console.log('[DataStore] 💾 Datos guardados en caché');

        // 🔁 Disparar pre-descarga en background (no bloquea)
        get().preloadOfflineCache();

        // ✅ Sincronización exitosa
        useConnectivityStore.getState().setSuccess();
      } else {
        // No se pudo obtener ningún dato del servidor a pesar de estar online
        console.warn('[DataStore] ⚠️ No se obtuvieron datos del servidor');
        useConnectivityStore.getState().setSyncing(false);
      }
      
    } catch (error) {
      console.error('[DataStore] Error in loadAllData:', error);
      useConnectivityStore.getState().setSyncing(false);
    } finally {
      set({
        isInitialLoading: false,
        isRefreshing: false,
        isSyncing: false,
        syncStatusMessage: '',
      });
    }
  },

  refreshSubjects: async () => {
    try {
      const data = await getSubjects();
      if (data) {
        set({ subjects: data });
        await cacheService.saveSubjects(data);
      }
    } catch (error) {
      console.error('Error refreshing subjects:', error);
    }
  },

  refreshAssessments: async () => {
    try {
      const data = await getAllAssessments();
      if (data) {
        set({ assessments: data });
        await cacheService.saveAssessments(data);
      }
    } catch (error) {
      console.error('Error refreshing assessments:', error);
    }
  },

  refreshSchedules: async () => {
    try {
      const data = await getAllSchedules();
      if (data) {
        set({ schedules: data });
        await cacheService.saveSchedules(data);
      }
    } catch (error) {
      console.error('Error refreshing schedules:', error);
    }
  },

  refreshPredictions: async (userId: string | number) => {
    try {
      console.log(`[DataStore] Refrescando predicciones para userId=${userId}`);
      
      // 🚀 Primero intentar cargar del caché (instantáneo)
      const cachedPredictions = await cacheService.loadPredictions() as PredictionResponse | null;
      if (cachedPredictions) {
        console.log(`[DataStore] 📦 Predicciones del caché mostradas`);
        set({ predictions: cachedPredictions });
      } else {
        // Valor por defecto mientras se carga
        set({ predictions: { dueCount: 0, cards: [] } });
      }
      
      // 🌐 Luego actualizar desde el servidor en segundo plano
      const data = await getPredictions(userId);
      console.log(`[DataStore] ✅ Predicciones actualizadas:`, data);
      set({ predictions: data });
      
      // 💾 Guardar en caché
      await Promise.all([
        cacheService.savePredictions(data),
        savePredictionsToCache(data)
      ]);
    } catch (error) {
      console.error('[DataStore] Error refreshing predictions:', error);
      // No sobrescribir con vacío si ya hay datos del caché mostrados
      const currentPredictions = get().predictions;
      if (!currentPredictions || currentPredictions.dueCount === 0 && currentPredictions.cards?.length === 0) {
        set({ predictions: { dueCount: 0, cards: [] } });
      }
    }
  },

  loadCachedPredictions: async () => {
    try {
      console.log(`[DataStore] Cargando predicciones del cache`);
      const cachedData = await loadPredictionsFromCache() as PredictionResponse | null;
      if (cachedData) {
        console.log(`[DataStore] ✅ Predicciones cargadas del cache`, cachedData);
        set({ predictions: cachedData });
      } else {
        console.log(`[DataStore] ℹ️ No hay predicciones en cache`);
        set({ predictions: { dueCount: 0, cards: [] } });
      }
    } catch (error) {
      console.error('[DataStore] Error cargando cache:', error);
      set({ predictions: { dueCount: 0, cards: [] } });
    }
  },

  preloadOfflineCache: async () => {
    try {
      console.log('[Cache] 🔁 Pre-descarga de datos en segundo plano...');
      const state = get();
      
      // Asegurarnos de que tenemos los subjects
      let subjectsToProcess = state.subjects;
      if (!subjectsToProcess || subjectsToProcess.length === 0) {
        subjectsToProcess = await getSubjects().catch(() => []);
      }

      // Descargar y cachear galerías, audios, videos y mazos
      const [decks, galleryItems, audioRecordings] = await Promise.all([
        getFlashcardDecks().catch(() => []),
        getGalleryItems().catch(() => []),
        getAudioRecordings().catch(() => []),
      ]);

      // Guardar en caché SOLO si hay datos reales (evita sobrescribir con vacío cuando offline)
      if (galleryItems && galleryItems.length > 0) {
        await cacheService.saveGalleryItems(galleryItems);
      }
      if (audioRecordings && audioRecordings.length > 0) {
        await cacheService.saveAudioRecordings(audioRecordings);
      }
      if (decks && decks.length > 0) {
        await cacheService.saveFlashcardDecks(decks);
      }

      // Descargar y cachear dependencias de subjects (Fotos por materia y Documentos)
      if (subjectsToProcess && subjectsToProcess.length > 0) {
        await Promise.all(subjectsToProcess.map(async (sub) => {
          const [photos, docs] = await Promise.all([
            getPhotosBySubject(sub.id).catch(() => []),
            getScannedDocumentsBySubject(sub.id).catch(() => [])
          ]);
          const promises: Promise<void>[] = [];
          if (photos && photos.length > 0) {
            promises.push(cacheService.savePhotosBySubject(sub.id, photos));
          }
          if (docs && docs.length > 0) {
            promises.push(cacheService.saveScannedDocumentsBySubject(sub.id, docs));
          }
          await Promise.all(promises);
        }));
      }

      // Descargar y cachear dependencias de mazos (Flashcards)
      if (decks && decks.length > 0) {
        await Promise.all(decks.map(async (deck) => {
          const [cards, prioritized, notSnoozed] = await Promise.all([
            getFlashcards(deck.id).catch(() => []),
            getFlashcardsPrioritized(deck.id).catch(() => []),
            getCardsNotSnoozed(deck.id).catch(() => [])
          ]);
          const promises: Promise<void>[] = [];
          if (cards && cards.length > 0) {
            promises.push(cacheService.saveFlashcardsByDeck(deck.id, cards));
          }
          if (prioritized && prioritized.length > 0) {
            promises.push(cacheService.saveFlashcardsPrioritizedByDeck(deck.id, prioritized));
          }
          if (notSnoozed && notSnoozed.length > 0) {
            promises.push(cacheService.saveCardsNotSnoozedByDeck(deck.id, notSnoozed));
          }
          await Promise.all(promises);
        }));
      }

      console.log('[Cache] ✅ Pre-descarga completada y datos cacheados.');
    } catch (error) {
      console.error('[Cache] ❌ Error durante la pre-descarga:', error);
    }
  },

  loadCachedDataOnly: async () => {
    // Obsoleta por MMKV (ahora es síncrono al instanciar el store)
    console.log('[DataStore] 📦 loadCachedDataOnly llamado pero ya está hidratado por MMKV.');
  },

  getDuedeckIds: () => {
    const state = get();
    if (!state.predictions?.cards) return new Set<number>();
    // Extraer IDs únicos de mazos que tienen tarjetas por repasar
    return new Set(
      state.predictions.cards
        .filter(card => card.deckId !== undefined)
        .map(card => card.deckId as number)
    );
  },

  syncPendingOperations: async () => {
    try {
      console.log('[DataStore] 🔄 Sincronizando operaciones offline pendientes...');
      
      // Importar fetch desde el cliente
      // Sincronizar todas las operaciones pendientes
      const result = await offlineSyncService.syncPendingOperations(fetchWithFallback);
      
      console.log(`[DataStore] ✅ Sincronización completada: ${result.success} éxito, ${result.failed} fallos, ${result.pending} pendientes`);
      
      // Si hubo éxitos, refrescar datos
      if (result.success > 0) {
        console.log('[DataStore] 🔄 Refrescando datos después de sincronización...');
        await get().loadAllData(true);
      }
      
      return result;
    } catch (error) {
      console.error('[DataStore] Error sincronizando operaciones offline:', error);
      return { success: 0, failed: 0, pending: 0 };
    }
  }
}));
