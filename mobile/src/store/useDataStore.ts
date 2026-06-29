import { create } from 'zustand';
import type {
  Course,
  Subject,
  Assessment,
  Schedule,
} from '../services/database/repositories';
import {
  courseRepository,
  subjectRepository,
  assessmentRepository,
  scheduleRepository,
  databaseService,
} from '../services/database';
import { syncManager } from '../services/sync/SyncManager';
import { repositoryEventBus } from '../services/events/RepositoryEventBus';

export interface PredictionItem {
  cardId: number;
  question: string;
  deckId?: number;
  deckTitle?: string;
  subjectId: number;
  mastery: number;
  urgency: 'HIGH' | 'MEDIUM';
  failureRate?: number;
}

export interface PredictionResponse {
  dueCount: number;
  deckCount?: number;
  cards: PredictionItem[];
}

interface DataState {
  courses: Course[];
  subjects: Subject[];
  assessments: Assessment[];
  schedules: Schedule[];
  predictions: PredictionResponse | null;
  calendarEvents: any[];
  flashcardDecks: any[];
  userStats: any | null;

  isInitialLoading: boolean;
  isRefreshing: boolean;
  hasLoadedOnce: boolean;
  isSyncing: boolean;
  syncStatusMessage: string;
  syncState: string;

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

export const useDataStore = create<DataState>((set, get) => {
  repositoryEventBus.on('courses', () => {
    get().refreshCourses();
  });
  repositoryEventBus.on('subjects', () => {
    get().refreshSubjects();
  });
  repositoryEventBus.on('assessments', () => {
    get().refreshAssessments();
  });
  repositoryEventBus.on('schedules', () => {
    get().refreshSchedules();
  });

  return {
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
  syncState: 'UNAUTHENTICATED',

  loadAllData: async (forceRefresh = false) => {
    const state = get();
    if (state.isInitialLoading && !forceRefresh) return;
    if (state.hasLoadedOnce && !forceRefresh) return;

    if (!state.hasLoadedOnce) {
      set({ isInitialLoading: true });
    } else {
      set({ isRefreshing: true });
    }

    try {
      await databaseService.open();

      const dbCourses = await courseRepository.getAll();
      set({ courses: dbCourses || [] });

      const dbSubjects = await subjectRepository.getAll();
      set({ subjects: dbSubjects || [] });

      const dbAssessments = await assessmentRepository.getAll();
      set({ assessments: dbAssessments || [] });

      const dbSchedules = await scheduleRepository.getAll();
      set({ schedules: dbSchedules || [] });

      set({ hasLoadedOnce: true, isInitialLoading: false });
    } catch (error) {
      console.error('[DataStore] Error in loadAllData:', error);
    } finally {
      set({ isInitialLoading: false, isRefreshing: false, isSyncing: false, syncStatusMessage: '' });
    }
  },

  refreshCourses: async () => {
    try {
      const dbCourses = await courseRepository.getAll();
      set({ courses: dbCourses || [] });
    } catch (error) {
      console.error('[DataStore] refreshCourses error:', error);
    }
  },

  refreshSubjects: async () => {
    try {
      const dbSubjects = await subjectRepository.getAll();
      set({ subjects: dbSubjects || [] });
    } catch (error) {
      console.error('[DataStore] refreshSubjects error:', error);
    }
  },

  refreshAssessments: async () => {
    try {
      const dbAssessments = await assessmentRepository.getAll();
      set({ assessments: dbAssessments || [] });
    } catch (error) {
      console.error('[DataStore] refreshAssessments error:', error);
    }
  },

  refreshSchedules: async () => {
    try {
      const dbSchedules = await scheduleRepository.getAll();
      set({ schedules: dbSchedules || [] });
    } catch (error) {
      console.error('[DataStore] refreshSchedules error:', error);
    }
  },

  refreshPredictions: async (userId: string | number) => {
    try {
      const { getLocalPredictions } = await import('../services/localMasteryService');
      const data = await getLocalPredictions(String(userId));
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
      const { flashcardDeckRepository } = await import('../services/database/repositories/FlashcardDeckRepository');
      const { flashcardRepository } = await import('../services/database/repositories/FlashcardRepository');
      const decks = await flashcardDeckRepository.getAll();
      if (Array.isArray(decks) && decks.length > 0) set({ flashcardDecks: decks });
      if (Array.isArray(decks) && decks.length > 0) {
        await Promise.all(decks.map(async (d: any) => {
          await flashcardRepository.getByField('deck_id', d.id).catch(() => []);
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
    const result = await syncManager.sync();
    return { success: result.entitiesSynced, failed: result.errors.length, pending: 0 };
  },
};
});
