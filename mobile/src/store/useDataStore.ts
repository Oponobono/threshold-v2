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
  refreshSubjects: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshPredictions: (userId: string | number) => Promise<void>;
  loadCachedPredictions: () => Promise<void>;
  preloadOfflineCache: () => Promise<void>;
  
  // Selectores
  getDuedeckIds: () => Set<number>;
}

export const useDataStore = create<DataState>((set, get) => ({
  subjects: [],
  assessments: [],
  schedules: [],
  predictions: null,

  isInitialLoading: false,
  isRefreshing: false,
  hasLoadedOnce: false,

  loadAllData: async (forceRefresh = false) => {
    const state = get();
    // Previene múltiples llamadas simultáneas
    if (state.isInitialLoading || state.isRefreshing) return;
    
    // Si ya cargó y no forzamos un refresco, salir
    if (state.hasLoadedOnce && !forceRefresh) return;

    if (!state.hasLoadedOnce) {
      set({ isInitialLoading: true });
    } else {
      set({ isRefreshing: true });
    }

    try {
      const [subjectsData, assessmentsData, schedulesData] = await Promise.all([
        getSubjects().catch(() => []),
        getAllAssessments().catch(() => []),
        getAllSchedules().catch(() => [])
      ]);

      set({
        subjects: subjectsData || [],
        assessments: assessmentsData || [],
        schedules: schedulesData || [],
        hasLoadedOnce: true,
      });

      // Disparar en background la pre-descarga de la caché global
      get().preloadOfflineCache();
      
    } catch (error) {
      console.error('Error in DataStore loadAllData:', error);
    } finally {
      set({ isInitialLoading: false, isRefreshing: false });
    }
  },

  refreshSubjects: async () => {
    try {
      const data = await getSubjects();
      set({ subjects: data || [] });
    } catch (error) {
      console.error('Error refreshing subjects:', error);
    }
  },

  refreshAssessments: async () => {
    try {
      const data = await getAllAssessments();
      set({ assessments: data || [] });
    } catch (error) {
      console.error('Error refreshing assessments:', error);
    }
  },

  refreshSchedules: async () => {
    try {
      const data = await getAllSchedules();
      set({ schedules: data || [] });
    } catch (error) {
      console.error('Error refreshing schedules:', error);
    }
  },

  refreshPredictions: async (userId: string | number) => {
    try {
      console.log(`[DataStore] Refrescando predicciones para userId=${userId}`);
      const data = await getPredictions(userId);
      console.log(`[DataStore] ✅ Predicciones actualizadas:`, data);
      set({ predictions: data });
      // Guardar en cache
      await savePredictionsToCache(data);
    } catch (error) {
      console.error('Error refreshing predictions:', error);
      // Fallback: mostrar datos vacíos
      set({ predictions: { dueCount: 0, cards: [] } });
    }
  },

  loadCachedPredictions: async () => {
    try {
      console.log(`[DataStore] Cargando predicciones del cache`);
      const cachedData = await loadPredictionsFromCache();
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
      console.log('[Cache] Iniciando pre-descarga de datos offline en segundo plano...');
      const state = get();
      
      // Asegurarnos de que tenemos los subjects
      let subjectsToProcess = state.subjects;
      if (!subjectsToProcess || subjectsToProcess.length === 0) {
        subjectsToProcess = await getSubjects().catch(() => []);
      }

      // Descargar galerías, audios y mazos
      const [decks] = await Promise.all([
        getFlashcardDecks().catch(() => []),
        getFlashcardDecksWithMetrics().catch(() => []),
        getGalleryItems().catch(() => []),
        getAudioRecordings().catch(() => [])
      ]);

      // Descargar dependencias de subjects (Fotos por materia y Documentos)
      if (subjectsToProcess && subjectsToProcess.length > 0) {
        for (const sub of subjectsToProcess) {
          await Promise.all([
            getPhotosBySubject(sub.id).catch(() => []),
            getScannedDocumentsBySubject(sub.id).catch(() => [])
          ]);
        }
      }

      // Descargar dependencias de mazos (Flashcards)
      if (decks && decks.length > 0) {
        for (const deck of decks) {
          await Promise.all([
            getFlashcards(deck.id).catch(() => []),
            getFlashcardsPrioritized(deck.id).catch(() => []),
            getCardsNotSnoozed(deck.id).catch(() => [])
          ]);
        }
      }

      console.log('[Cache] ✅ Pre-descarga de datos completada exitosamente.');
    } catch (error) {
      console.error('[Cache] ❌ Error durante la pre-descarga:', error);
    }
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
