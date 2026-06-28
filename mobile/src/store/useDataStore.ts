import { create } from 'zustand';
import { Course, Subject, Assessment, Schedule } from '../services/api';
import {
  courseRepository,
  subjectRepository,
  assessmentRepository,
  scheduleRepository,
  syncService,
  databaseService,
} from '../services/database';

interface DataState {
  courses: Course[];
  subjects: Subject[];
  assessments: Assessment[];
  schedules: Schedule[];
  predictions: any;
  calendarEvents: any[];
  flashcardDecks: any[];
  userStats: any | null;

  isInitialLoading: boolean;
  isRefreshing: boolean;
  hasLoadedOnce: boolean;
  isSyncing: boolean;
  syncStatusMessage: string;
  _lastLoadAllDataTimestamp: number;

  loadAllData: (forceRefresh?: boolean) => Promise<void>;
  refreshCourses: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshPredictions: (userId: string | number) => Promise<void>;
  loadCachedPredictions: () => Promise<void>;
  preloadOfflineCache: () => Promise<void>;
  syncPendingOperations: () => Promise<{ success: number; failed: number; pending: number }>;
  getDuedeckIds: () => Set<string>;
}

export const useDataStore = create<DataState>((set, get) => ({
  courses: [],
  subjects: [],
  assessments: [],
  schedules: [],
  predictions: null,
  calendarEvents: [],
  flashcardDecks: [],
  userStats: null,

  isInitialLoading: false,
  isRefreshing: false,
  hasLoadedOnce: false,
  isSyncing: false,
  syncStatusMessage: '',
  _lastLoadAllDataTimestamp: 0,

  loadAllData: async (forceRefresh = false) => {
    const state = get();
    if (state.isInitialLoading || state.isRefreshing) return;
    if (state.hasLoadedOnce && !forceRefresh) return;

    // Debounce: evitar que llamadas rápidas consecutivas disparen otra carga
    const LOAD_ALL_DATA_DEBOUNCE_MS = 5000;
    const now = Date.now();
    if (state._lastLoadAllDataTimestamp && (now - state._lastLoadAllDataTimestamp < LOAD_ALL_DATA_DEBOUNCE_MS)) {
      return;
    }

    if (!state.hasLoadedOnce) {
      set({ isInitialLoading: true, _lastLoadAllDataTimestamp: now });
    } else {
      set({ isRefreshing: true, _lastLoadAllDataTimestamp: now });
    }

    try {
      await databaseService.open();

      const { getCourses } = await import('../services/api/courses');
      const dbCourses = await getCourses() as any;
      set({ courses: dbCourses });
      
      const { getSubjects } = await import('../services/api/subjects');
      const dbSubjects = await getSubjects() as any;
      set({ subjects: dbSubjects });
      
      const { getAllAssessments } = await import('../services/api/assessments');
      const dbAssessments = await getAllAssessments() as any;
      set({ assessments: dbAssessments });
      
      const { getAllSchedules } = await import('../services/api/schedules');
      const dbSchedules = await getAllSchedules() as any;
      set({ schedules: dbSchedules });

      set({ hasLoadedOnce: true, isInitialLoading: false });

      // OFFLINE-FIRST: los datos locales de SQLite son la fuente de verdad.
      // El cloud nunca sobreescribe el estado de la UI.
      // Solo se usa para reparar enlaces y pre-cargar caché offline.
      const { repairSubjectCourseLinks } = await import('../services/api');
      await repairSubjectCourseLinks().catch(() => {});

      // Pre-cargar caché offline en background sin reemplazar estado local
      get().preloadOfflineCache().catch(() => {});
    } catch (error) {
      console.error('[DataStore] Error in loadAllData:', error);
    } finally {
      set({ isInitialLoading: false, isRefreshing: false, isSyncing: false, syncStatusMessage: '' });
    }
  },

  refreshCourses: async () => {
    // OFFLINE-FIRST: recargar desde SQLite local, no desde cloud.
    // El cloud es solo backup, nunca fuente de verdad.
    try {
      const { getCourses } = await import('../services/api/courses');
      const dbCourses = await getCourses() as any;
      set({ courses: dbCourses });
    } catch (error) {
      console.error('[DataStore] refreshCourses error:', error);
    }
  },

  refreshSubjects: async () => {
    try {
      const { getSubjects } = await import('../services/api/subjects');
      const dbSubjects = await getSubjects() as any;
      set({ subjects: dbSubjects });
      const { repairSubjectCourseLinks } = await import('../services/api');
      await repairSubjectCourseLinks().catch(() => {});
    } catch (error) {
      console.error('[DataStore] refreshSubjects error:', error);
    }
  },

  refreshAssessments: async () => {
    try {
      const { getAllAssessments } = await import('../services/api/assessments');
      const dbAssessments = await getAllAssessments() as any;
      set({ assessments: dbAssessments });
    } catch (error) {
      console.error('[DataStore] refreshAssessments error:', error);
    }
  },

  refreshSchedules: async () => {
    try {
      const { getAllSchedules } = await import('../services/api/schedules');
      const dbSchedules = await getAllSchedules() as any;
      set({ schedules: dbSchedules });
    } catch (error) {
      console.error('[DataStore] refreshSchedules error:', error);
    }
  },

  refreshPredictions: async (userId: string | number) => {
    try {
      const { getPredictions } = await import('../services/api');
      const data = await getPredictions(userId);
      set({ predictions: data || { dueCount: 0, cards: [] } });
    } catch (error) {
      console.error('[DataStore] refreshPredictions error:', error);
      if (!get().predictions) set({ predictions: { dueCount: 0, cards: [] } });
    }
  },

  loadCachedPredictions: async () => {
    set({ predictions: { dueCount: 0, cards: [] } });
  },

  preloadOfflineCache: async () => {
    try {
      const { getFlashcardDecks, getGalleryItems, getAudioRecordings } = await import('../services/api');
      const decks = await getFlashcardDecks().catch(() => []);

      if (Array.isArray(decks) && decks.length > 0) set({ flashcardDecks: decks });

      if (Array.isArray(decks) && decks.length > 0) {
        const { getFlashcards } = await import('../services/api');
        await Promise.all(decks.map(async (d: any) => {
          await getFlashcards(d.id).catch(() => []);
        }));
      }
    } catch (error) {
      console.error('[DataStore] preloadOfflineCache error:', error);
    }
  },

  getDuedeckIds: () => {
    const state = get();
    if (!state.predictions?.cards) return new Set();
    return new Set(
      state.predictions.cards
        .filter((card: any) => card.deckId !== undefined)
        .map((card: any) => String(card.deckId))
    );
  },

  syncPendingOperations: async () => {
    // OFFLINE-FIRST: sync solo PUSH local → cloud.
    // No se recarga desde cloud porque local es la fuente de verdad.
    const result = await syncService.sync();
    return result;
  },
}));
