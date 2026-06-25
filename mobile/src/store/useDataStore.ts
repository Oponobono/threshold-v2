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

      const dbCourses = await courseRepository.getAll() as any;
      set({ courses: dbCourses });
      const dbSubjects = await subjectRepository.getAll() as any;
      set({ subjects: dbSubjects });
      const dbAssessments = await assessmentRepository.getAll() as any;
      set({ assessments: dbAssessments });
      const dbSchedules = await scheduleRepository.getAll() as any;
      set({ schedules: dbSchedules });

      set({ hasLoadedOnce: true, isInitialLoading: false });

      const { getCourses, getSubjects, getAllAssessments, getAllSchedules, repairSubjectCourseLinks } = await import('../services/api');
      const [coursesData, subjectsData, assessmentsData, schedulesData] = await Promise.all([
        getCourses().catch(() => null),
        getSubjects().catch(() => null),
        getAllAssessments().catch(() => null),
        getAllSchedules().catch(() => null),
      ]);

      // Reparar enlaces curso-materia y actualizar contadores
      await repairSubjectCourseLinks().catch(() => {});

      if (coursesData && Array.isArray(coursesData)) set({ courses: coursesData });
      if (subjectsData && Array.isArray(subjectsData)) set({ subjects: subjectsData });
      if (assessmentsData && Array.isArray(assessmentsData)) set({ assessments: assessmentsData });
      if (schedulesData && Array.isArray(schedulesData)) set({ schedules: schedulesData });

      const hasCloudData = (subjectsData && subjectsData.length > 0) ||
        (assessmentsData && assessmentsData.length > 0) ||
        (schedulesData && schedulesData.length > 0);
      if (hasCloudData) {
        set({ isSyncing: true, syncStatusMessage: 'Sincronizando datos...' });
        await get().preloadOfflineCache();
      }
    } catch (error) {
      console.error('[DataStore] Error in loadAllData:', error);
    } finally {
      set({ isInitialLoading: false, isRefreshing: false, isSyncing: false, syncStatusMessage: '' });
    }
  },

  refreshCourses: async () => {
    try {
      const { getCourses } = await import('../services/api');
      const data = await getCourses();
      if (data && Array.isArray(data)) set({ courses: data as any });
    } catch (error) {
      console.error('[DataStore] refreshCourses error:', error);
    }
  },

  refreshSubjects: async () => {
    try {
      const { getCourses, getSubjects, repairSubjectCourseLinks } = await import('../services/api');
      const coursesData = await getCourses();
      if (coursesData && Array.isArray(coursesData)) set({ courses: coursesData as any });
      const data = await getSubjects();
      if (data) set({ subjects: data as any });
      await repairSubjectCourseLinks().catch(() => {});
    } catch (error) {
      console.error('[DataStore] refreshSubjects error:', error);
    }
  },

  refreshAssessments: async () => {
    try {
      const { getAllAssessments } = await import('../services/api');
      const data = await getAllAssessments();
      if (data) set({ assessments: data as any });
    } catch (error) {
      console.error('[DataStore] refreshAssessments error:', error);
    }
  },

  refreshSchedules: async () => {
    try {
      const { getAllSchedules } = await import('../services/api');
      const data = await getAllSchedules();
      if (data) set({ schedules: data as any });
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
    const result = await syncService.sync();
    if (result.success > 0) await get().loadAllData(true);
    return result;
  },
}));
