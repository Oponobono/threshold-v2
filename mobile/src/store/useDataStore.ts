import { create } from 'zustand';
import { 
  Subject, Assessment, Schedule, 
  getSubjects, getAllAssessments, getAllSchedules, 
  getPredictions, PredictionResponse,
  getGalleryItems, getPhotosBySubject,
  getAudioRecordings,
  getFlashcardDecks, getFlashcardDecksWithMetrics, getFlashcards, getFlashcardsPrioritized, getCardsNotSnoozed,
  getScannedDocumentsBySubject
} from '../services/api';
import { loadPredictionsFromCache, savePredictionsToCache } from '../hooks/usePredictionPolling';
import { cacheService } from '../services/cacheService';

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

  // Acciones (Mutadores globales)
  loadAllData: (forceRefresh?: boolean) => Promise<void>;
  loadCachedDataOnly: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshPredictions: (userId: string | number) => Promise<void>;
  loadCachedPredictions: () => Promise<void>;
  preloadOfflineCache: () => Promise<void>;
  
  // Selectores
  getDuedeckIds: () => Set<number>;
}

// Intenta leer del caché síncrono de MMKV. Si el módulo nativo no está listo
// todavía (primer arranque en frío), cae en el valor por defecto sin crashear.
const trySync = <T>(fn: () => T | null, fallback: T): T => {
  try { return fn() ?? fallback; } catch (_e) { return fallback; }
};

export const useDataStore = create<DataState>((set, get) => ({
  subjects: trySync(() => cacheService.loadSubjectsSync(), []) as any[],
  assessments: trySync(() => cacheService.loadAssessmentsSync(), []) as any[],
  schedules: trySync(() => cacheService.loadSchedulesSync(), []) as any[],
  predictions: trySync<PredictionResponse | null>(() => cacheService.loadPredictionsSync() as PredictionResponse | null, null),

  isInitialLoading: false,
  isRefreshing: false,
  // false para que loadAllData contacte al servidor en el primer uso.
  // La UI ya tiene datos instantáneos gracias a MMKV (líneas 47-50).
  hasLoadedOnce: false,

  loadAllData: async (forceRefresh = false) => {
    const state = get();
    // Previene múltiples llamadas simultáneas
    if (state.isInitialLoading || state.isRefreshing) return;
    
    // Si ya cargó y no forzamos un refresco, salir (excepto si forceRefresh es true)
    if (state.hasLoadedOnce && !forceRefresh) return;

    if (!state.hasLoadedOnce) {
      set({ isInitialLoading: true });
    } else {
      set({ isRefreshing: true });
    }

    try {
      // 🌐 FASE 2: Hacer llamadas al backend en paralelo
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
      
      if (subjectsData !== null) {
        updatedState.subjects = subjectsData;
      }
      if (assessmentsData !== null) {
        updatedState.assessments = assessmentsData;
      }
      if (schedulesData !== null) {
        updatedState.schedules = schedulesData;
      }

      set(updatedState);

      // 💾 FASE 3: Guardar en caché solo lo que se obtuvo exitosamente
      if (subjectsData !== null) {
        await cacheService.saveSubjects(subjectsData);
      }
      if (assessmentsData !== null) {
        await cacheService.saveAssessments(assessmentsData);
      }
      if (schedulesData !== null) {
        await cacheService.saveSchedules(schedulesData);
      }
      console.log('[DataStore] 💾 Datos guardados en caché');

      // 🔁 FASE 4: Disparar pre-descarga en background (no bloquea)
      get().preloadOfflineCache();
      
    } catch (error) {
      console.error('[DataStore] Error in loadAllData:', error);
    } finally {
      set({ isInitialLoading: false, isRefreshing: false });
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
      }
    } catch (error) {
      console.error('Error refreshing schedules:', error);
      // No setear datos vacíos si falla - mantener los existentes
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
      // Fallback: mostrar datos vacíos
      set({ predictions: { dueCount: 0, cards: [] } });
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

      // Guardar en caché
      await Promise.all([
        cacheService.saveGalleryItems(galleryItems || []),
        cacheService.saveAudioRecordings(audioRecordings || []),
        cacheService.saveFlashcardDecks(decks || []),
      ]);

      // Descargar y cachear dependencias de subjects (Fotos por materia y Documentos)
      if (subjectsToProcess && subjectsToProcess.length > 0) {
        for (const sub of subjectsToProcess) {
          const [photos, docs] = await Promise.all([
            getPhotosBySubject(sub.id).catch(() => []),
            getScannedDocumentsBySubject(sub.id).catch(() => [])
          ]);
          // Guardar en caché
          await Promise.all([
            cacheService.savePhotosBySubject(sub.id, photos || []),
            cacheService.saveScannedDocumentsBySubject(sub.id, docs || [])
          ]);
        }
      }

      // Descargar y cachear dependencias de mazos (Flashcards)
      if (decks && decks.length > 0) {
        for (const deck of decks) {
          const [cards, prioritized, notSnoozed] = await Promise.all([
            getFlashcards(deck.id).catch(() => []),
            getFlashcardsPrioritized(deck.id).catch(() => []),
            getCardsNotSnoozed(deck.id).catch(() => [])
          ]);
          // Guardar en caché
          await Promise.all([
            cacheService.saveFlashcardsByDeck(deck.id, cards || []),
            cacheService.saveFlashcardsPrioritizedByDeck(deck.id, prioritized || []),
            cacheService.saveCardsNotSnoozedByDeck(deck.id, notSnoozed || [])
          ]);
        }
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
  }
}));
