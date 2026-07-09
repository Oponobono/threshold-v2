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
import { userRepository } from '../services/database/repositories/UserRepository';
import { storageService } from '../services/storageService';
import { getCurrentUserProfile } from '../services/api/auth/profile';
import { getUserGroups } from '../services/api/learning/groups';
import { getLocalGlobalGPA, getLocalPredictions } from '../services/localMasteryService';
import { getTodaySchedules } from '../services/api/schedules';
import { flashcardDeckRepository } from '../services/database/repositories/FlashcardDeckRepository';
import { flashcardRepository } from '../services/database/repositories/FlashcardRepository';
import type { UserProfile } from '../services/api/types';

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
  dueCardsCount?: number;
  deckCount?: number;
  dueDeckCount?: number;
  cards: PredictionItem[];
  dueDeckIds?: string[];
}

export interface GroupMembership {
  id?: string;
  user_id?: string;
  group_pin_id: string;
  name?: string;
  role?: string;
  joined_at?: string;
  is_public?: boolean;
  password?: string;
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
  profile: UserProfile | null;
  userGroups: GroupMembership[];
  overallGpa: number | null;

  isInitialLoading: boolean;
  isRefreshing: boolean;
  hasLoadedOnce: boolean;
  lastLoadTimestamp: number;
  isSyncing: boolean;
  syncStatusMessage: string;
  syncState: string;

  loadAllData: (forceRefresh?: boolean) => Promise<void>;
  refreshCourses: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUserGroups: () => Promise<void>;
  refreshOverallGpa: () => Promise<void>;
  syncTodaySchedules: () => Promise<void>;
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
  profile: null,
  userGroups: [],
  overallGpa: null,

  isInitialLoading: false,
  isRefreshing: false,
  hasLoadedOnce: false,
  lastLoadTimestamp: 0,
  isSyncing: false,
  syncStatusMessage: '',
  syncState: 'UNAUTHENTICATED',

  loadAllData: async (forceRefresh = false) => {
    const state = get();

    // Si ya se cargó hace menos de 1s, omitir incluso con forceRefresh.
    // Esto evita la duplicación Bootstrap → ProgressiveDataLoading.
    if (state.hasLoadedOnce && forceRefresh && Date.now() - state.lastLoadTimestamp < 1000) {
      console.log('[DataStore] loadAllData(true) skipped — loaded recently');
      return;
    }

    if (state.isInitialLoading && !forceRefresh) return;
    if (state.hasLoadedOnce && !forceRefresh) return;

    if (!state.hasLoadedOnce) {
      set({ isInitialLoading: true });
    } else {
      set({ isRefreshing: true });
    }

    console.trace('[DataStore] loadAllData() called');
    console.log('[DataStore] loadAllData() caller stack captured above');

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

      const currentUser = await userRepository.getCurrentUser();
      if (currentUser) {
        set({ profile: currentUser as any });
      }

      const groupsCache = await storageService.getLocal('app:cache:userGroups');
      if (groupsCache) {
        try { set({ userGroups: JSON.parse(groupsCache) }); } catch {}
      }

      const gpaCache = await storageService.getLocal('app:cache:global_gpa');
      if (gpaCache) {
        try {
          const parsed = JSON.parse(gpaCache);
          set({ overallGpa: parsed.currentAverage ?? null });
        } catch {}
      }

      set({ hasLoadedOnce: true, lastLoadTimestamp: Date.now(), isInitialLoading: false });
    } catch (error) {
      console.error('[DataStore] Error in loadAllData:', error);
      set({ hasLoadedOnce: true, lastLoadTimestamp: Date.now() });
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

  refreshProfile: async () => {
    try {
      const fresh = await getCurrentUserProfile();
      if (fresh) {
        await userRepository.saveProfile(fresh);
        set({ profile: fresh });
      }
    } catch {}
  },

  refreshUserGroups: async () => {
    try {
      const groups = await getUserGroups();
      if (Array.isArray(groups)) {
        set({ userGroups: groups });
        await storageService.saveLocal('app:cache:userGroups', JSON.stringify(groups));
      }
    } catch {}
  },

  refreshOverallGpa: async () => {
    const _t0 = performance.now();
    try {
      const profile = get().profile;
      if (profile?.id) {
        const localGpa = await getLocalGlobalGPA(profile.id);
        if (localGpa.assessmentCount > 0) {
          set({ overallGpa: localGpa.currentAverage ?? 0 });
        }
      }
    } catch {} finally {
      const _t = performance.now() - _t0;
      if (_t > 100) {
        console.log(`[GpaChain] refreshOverallGpa TOTAL: ${_t.toFixed(0)}ms`);
      }
    }
  },

  syncTodaySchedules: async () => {
    try {
      await getTodaySchedules();
      get().refreshSchedules();
    } catch {}
  },

  refreshPredictions: async (userId: string | number) => {
    try {
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
    if (state.predictions?.dueDeckIds) return new Set(state.predictions.dueDeckIds);
    if (!state.predictions?.cards) return new Set();
    return new Set(
      state.predictions.cards
        .filter((card: any) => card.deckId !== undefined)
        .map((card: any) => String(card.deckId))
    );
  },

  syncPendingOperations: async () => {
    console.trace('[DataStore] syncPendingOperations() called');
    console.log('[DataStore] syncPendingOperations() caller stack captured above');
    const result = await syncManager.sync();
    return { success: result.entitiesSynced, failed: result.errors.length, pending: 0 };
  },
};
});
