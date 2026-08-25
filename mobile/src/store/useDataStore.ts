import { create } from 'zustand';
import type {
  Course,
  Subject,
  Assessment,
  Schedule,
  Photo,
} from '../services/database/repositories';
import {
  databaseService,
} from '../services/database';
import { RepositoryFactory } from '../services/database/RepositoryFactory';
import { syncManager } from '../services/sync/SyncManager';
import { repositoryEventBus } from '../services/events/RepositoryEventBus';
import { storageService } from '../services/storageService';
import { getCurrentUserProfile } from '../services/api/auth/profile';
import { getUserGroups } from '../services/api/learning/groups';
import { getLocalGlobalGPA, getLocalPredictions } from '../services/localMasteryService';
import { loadPredictionsFromCache, savePredictionsToCache } from '../hooks/usePredictionPolling';
import { getTodaySchedules } from '../services/api/schedules';
import type { UserProfile } from '../services/api/types';
import { cachePolicy } from '../services/cache/CachePolicy';
import { perfDiagnostics } from '../services/performance';

const __DEV__ = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
function devLog(...args: any[]): void {
  if (__DEV__) console.log(...args);
}

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

export type PredictionsSource = 'none' | 'cache' | 'fresh';

interface DataState {
  courses: Course[];
  subjects: Subject[];
  assessments: Assessment[];
  schedules: Schedule[];
  predictions: PredictionResponse | null;
  predictionsSource: PredictionsSource;
  calendarEvents: any[];
  photos: Photo[];
  flashcardDecks: any[];
  userStats: any | null;
  profile: UserProfile | null;
  userGroups: GroupMembership[];
  overallGpa: number | null;

  entityTimestamps: Record<string, number>;

  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadedForSessionGeneration: string | null;
  loadedForUserId: string | null;
  lastLoadTimestamp: number;
  isSyncing: boolean;
  syncStatusMessage: string;
  syncState: string;

  loadAllData: (forceRefresh?: boolean) => Promise<void>;
  loadSecondaryData: () => Promise<void>;
  refreshCourses: () => Promise<void>;
  refreshSubjects: () => Promise<void>;
  refreshAssessments: () => Promise<void>;
  refreshSchedules: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUserGroups: () => Promise<void>;
  refreshOverallGpa: () => Promise<void>;
  refreshCalendarEvents: () => Promise<void>;
  refreshPhotos: () => Promise<void>;
  refreshFlashcardDecks: () => Promise<void>;
  syncTodaySchedules: () => Promise<void>;
  refreshPredictions: (userId: string | number) => Promise<void>;
  preloadOfflineCache: () => Promise<void>;
  syncPendingOperations: () => Promise<{ success: number; failed: number; pending: number }>;
  getDuedeckIds: () => Set<string>;
  resetStore: () => void;
}

function shouldRefreshEntity(entity: string, lastLoaded: number): boolean {
  if (!cachePolicy.isCacheable(entity)) return true;
  if (cachePolicy.getTTL(entity) === Infinity) return false;
  const age = Date.now() - lastLoaded;
  const ttl = cachePolicy.getTTL(entity);
  const isStale = age > ttl;
  return isStale;
}

export const useDataStore = create<DataState>((set, get) => {
  const { sessionIdentity } = require('../services/api/auth/SessionIdentity');

  repositoryEventBus.onBatch('courses', () => {
    get().refreshCourses();
  });
  repositoryEventBus.onBatch('subjects', () => {
    get().refreshSubjects();
  });
  repositoryEventBus.onBatch('assessments', () => {
    get().refreshAssessments();
  });
  repositoryEventBus.onBatch('schedules', () => {
    get().refreshSchedules();
  });
  repositoryEventBus.onBatch('flashcard_decks', () => {
    get().refreshFlashcardDecks();
  });
  repositoryEventBus.onBatch('calendar_events', () => {
    get().refreshCalendarEvents();
  });
  repositoryEventBus.onBatch('photos', () => {
    get().refreshPhotos();
  });

  // Boot Presentation Cache: hidratar síncronamente desde MMKV.
  // El userId aún no está disponible en el constructor del store,
  // así que el store arranca con predictionsSource='none' y predictions=null.
  // La hidratación real ocurre en loadAllData() después de resolver el profile.
  return {
  courses: [],
  subjects: [],
  assessments: [],
  schedules: [],
  predictions: null,
  predictionsSource: 'none' as PredictionsSource,
  calendarEvents: [],
  photos: [],
  flashcardDecks: [],
  userStats: null,
  profile: null,
  userGroups: [],
  overallGpa: null,
  entityTimestamps: {},

  isInitialLoading: false,
  isRefreshing: false,
  loadedForSessionGeneration: null,
  loadedForUserId: null,
  lastLoadTimestamp: 0,
  isSyncing: false,
  syncStatusMessage: '',
  syncState: 'UNAUTHENTICATED',

  resetStore: () => {
    set({
      courses: [],
      subjects: [],
      assessments: [],
      schedules: [],
      predictions: null,
      predictionsSource: 'none',
      calendarEvents: [],
      photos: [],
      flashcardDecks: [],
      userStats: null,
      profile: null,
      userGroups: [],
      overallGpa: null,
      entityTimestamps: {},
      isInitialLoading: false,
      isRefreshing: false,
      loadedForSessionGeneration: null,
      loadedForUserId: null,
      lastLoadTimestamp: 0,
      isSyncing: false,
      syncStatusMessage: '',
      syncState: 'UNAUTHENTICATED',
    });
  },

  loadAllData: async (forceRefresh = false) => {
    const state = get();
    const currentGeneration = sessionIdentity.currentGeneration;
    const currentUserId = sessionIdentity.currentUserId;

    if (!currentGeneration || !currentUserId) {
      devLog('[DataStore] loadAllData aborted: no active session generation');
      return;
    }

    if (state.loadedForSessionGeneration === currentGeneration && forceRefresh && Date.now() - state.lastLoadTimestamp < 1000) {
      devLog('[DataStore] loadAllData(true) skipped — loaded recently');
      return;
    }

    if (state.isInitialLoading && !forceRefresh) return;
    if (state.loadedForSessionGeneration === currentGeneration && !forceRefresh) return;

    if (state.loadedForSessionGeneration !== currentGeneration) {
      // Clear data if we're loading for a new session generation
      if (state.loadedForSessionGeneration !== null) {
          get().resetStore();
      }
      set({ isInitialLoading: true });
    } else {
      set({ isRefreshing: true });
    }

    devLog('[DataStore] loadAllData() called');
    const _auditT0 = __DEV__ ? performance.now() : 0;
    const _entityTimings: Record<string, number> = {};

    try {
      await databaseService.open();

      const now = Date.now();
      const timestamps = get().entityTimestamps;

      if (forceRefresh || shouldRefreshEntity('courses', timestamps.courses ?? 0)) {
        const dbCourses = await perfDiagnostics.measureAsync('sqlite.courses.getAll', () => RepositoryFactory.courses().getAll());
        const _hT = __DEV__ ? performance.now() : 0;
        set({ courses: dbCourses || [], entityTimestamps: { ...get().entityTimestamps, courses: now } });
        if (__DEV__) _entityTimings['courses'] = performance.now() - _hT;
      }

      if (forceRefresh || shouldRefreshEntity('subjects', timestamps.subjects ?? 0)) {
        const dbSubjects = await perfDiagnostics.measureAsync('sqlite.subjects.getAll', () => RepositoryFactory.subjects().getAll());
        const _hTS = __DEV__ ? performance.now() : 0;
        set({ subjects: dbSubjects || [], entityTimestamps: { ...get().entityTimestamps, subjects: now } });
        if (__DEV__) _entityTimings['subjects'] = performance.now() - _hTS;
      }

      if (forceRefresh || shouldRefreshEntity('assessments', timestamps.assessments ?? 0)) {
        const dbAssessments = await perfDiagnostics.measureAsync('sqlite.assessments.getAll', () => RepositoryFactory.assessments().getAll());
        set({ assessments: dbAssessments || [], entityTimestamps: { ...get().entityTimestamps, assessments: now } });
      }

      if (forceRefresh || shouldRefreshEntity('schedules', timestamps.schedules ?? 0)) {
        const dbSchedules = await perfDiagnostics.measureAsync('sqlite.schedules.getAll', () => RepositoryFactory.schedules().getAll());
        set({ schedules: dbSchedules || [], entityTimestamps: { ...get().entityTimestamps, schedules: now } });
      }

      if (forceRefresh || shouldRefreshEntity('calendar_events', timestamps.calendar_events ?? 0)) {
        const dbCalendarEvents = await perfDiagnostics.measureAsync('sqlite.calendarEvents.getAll', () => RepositoryFactory.calendarEvents().getAll());
        set({ calendarEvents: dbCalendarEvents || [], entityTimestamps: { ...get().entityTimestamps, calendar_events: now } });
      }

      const currentUser = await RepositoryFactory.users().getCurrentUser();
      if (currentUser) {
        set({ profile: currentUser as any });
        // Hidratar Boot Presentation Cache de predicciones ahora que tenemos userId.
        // loadPredictionsFromCache es síncrono (MMKV) — cero costo en el bridge.
        const userId = String((currentUser as any).id);
        const cachedPayload = loadPredictionsFromCache(userId);
        if (cachedPayload) {
          set({ predictions: cachedPayload.predictions, predictionsSource: 'cache' });
        }
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

      set({ 
        loadedForSessionGeneration: currentGeneration, 
        loadedForUserId: currentUserId,
        lastLoadTimestamp: Date.now(), 
        isInitialLoading: false 
      });
      if (__DEV__) {
        const totalMs = (performance.now() - _auditT0).toFixed(0);
        const hydrationSummary = Object.entries(_entityTimings).map(([k, v]) => `${k}:${v.toFixed(1)}ms`).join(' ');
        console.log(`[HYDRATION] loadAllData TOTAL=${totalMs}ms | per-entity set() timings: ${hydrationSummary}`);
      }
      // Defer secondary data (flashcard_decks, photos) after bridge is warm
      const { InteractionManager } = await import('react-native');
      InteractionManager.runAfterInteractions(() => {
        get().loadSecondaryData().catch(() => {});
      });
    } catch (error) {
      console.error('[DataStore] Error in loadAllData:', error);
      set({ lastLoadTimestamp: Date.now() });
    } finally {
      set({ isInitialLoading: false, isRefreshing: false, isSyncing: false, syncStatusMessage: '' });
    }
  },

  loadSecondaryData: async () => {
    try {
      const now = Date.now();
      const timestamps = get().entityTimestamps;
      devLog('[DataStore] loadSecondaryData() start');
      const _t0 = __DEV__ ? performance.now() : 0;

      if (shouldRefreshEntity('flashcard_decks', timestamps.flashcard_decks ?? 0)) {
        const decks = await RepositoryFactory.flashcardDecks().getAll();
        set({ flashcardDecks: decks || [], entityTimestamps: { ...get().entityTimestamps, flashcard_decks: now } });
      }

      if (shouldRefreshEntity('photos', timestamps.photos ?? 0)) {
        const photos = await RepositoryFactory.photos().getMetadata();
        set({ photos: photos || [], entityTimestamps: { ...get().entityTimestamps, photos: now } });
      }

      if (__DEV__) {
        console.log(`[HYDRATION] loadSecondaryData TOTAL=${(performance.now() - _t0).toFixed(0)}ms`);
      }
    } catch (error) {
      console.error('[DataStore] loadSecondaryData error:', error);
    }
  },

  refreshCourses: async () => {
    try {
      const dbCourses = await RepositoryFactory.courses().getAll();
      set({ courses: dbCourses || [] });
    } catch (error) {
      console.error('[DataStore] refreshCourses error:', error);
    }
  },

  refreshSubjects: async () => {
    try {
      const dbSubjects = await RepositoryFactory.subjects().getAll();
      set({ subjects: dbSubjects || [] });
    } catch (error) {
      console.error('[DataStore] refreshSubjects error:', error);
    }
  },

  refreshAssessments: async () => {
    try {
      const dbAssessments = await RepositoryFactory.assessments().getAll();
      set({ assessments: dbAssessments || [] });
    } catch (error) {
      console.error('[DataStore] refreshAssessments error:', error);
    }
  },

  refreshSchedules: async () => {
    try {
      const dbSchedules = await RepositoryFactory.schedules().getAll();
      set({ schedules: dbSchedules || [] });
    } catch (error) {
      console.error('[DataStore] refreshSchedules error:', error);
    }
  },

  refreshFlashcardDecks: async () => {
    try {
      const dbDecks = await RepositoryFactory.flashcardDecks().getAll();
      set({ flashcardDecks: dbDecks || [] });
    } catch (error) {
      console.error('[DataStore] refreshFlashcardDecks error:', error);
    }
  },

  refreshCalendarEvents: async () => {
    try {
      const dbEvents = await RepositoryFactory.calendarEvents().getAll();
      set({ calendarEvents: dbEvents || [] });
    } catch (error) {
      console.error('[DataStore] refreshCalendarEvents error:', error);
    }
  },

  refreshPhotos: async () => {
    try {
      const dbPhotos = await RepositoryFactory.photos().getMetadata();
      set({ photos: dbPhotos || [] });
    } catch (error) {
      console.error('[DataStore] refreshPhotos error:', error);
    }
  },

  refreshProfile: async () => {
    try {
      const fresh = await getCurrentUserProfile();
      if (fresh) {
        await RepositoryFactory.users().saveProfile(fresh);
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
      const result = data || { dueCount: 0, cards: [] };
      set({ predictions: result, predictionsSource: 'fresh' });
      // Persistir en Boot Presentation Cache (MMKV, síncrono)
      savePredictionsToCache(String(userId), result);
    } catch (error) {
      console.error('[DataStore] refreshPredictions error:', error);
      if (!get().predictions) set({ predictions: { dueCount: 0, cards: [] }, predictionsSource: 'fresh' });
    }
  },

  preloadOfflineCache: async () => {
    try {
      const decks = await RepositoryFactory.flashcardDecks().getAll();
      if (Array.isArray(decks) && decks.length > 0) set({ flashcardDecks: decks });
      if (Array.isArray(decks) && decks.length > 0) {
        await Promise.all(decks.map(async (d: any) => {
          await RepositoryFactory.flashcards().getByField('deck_id', d.id).catch(() => []);
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
    devLog('[DataStore] syncPendingOperations() called');
    const result = await syncManager.sync();
    return { success: result.entitiesSynced, failed: result.errors.length, pending: 0 };
  },
};
});
