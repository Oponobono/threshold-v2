import { MMKV, createMMKV } from 'react-native-mmkv';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio de caché persistente ultrarrápido.
 * Utiliza react-native-mmkv (C++ base) para guardar/cargar datos del dispositivo.
 * La instancia de MMKV se inicializa de forma lazy para evitar errores al cargar el módulo.
 */

// ─── Lazy Initialization ─────────────────────────────────────────────────────
// MMKV no puede ser instanciado en el top-level del módulo porque el módulo
// nativo podría no estar listo aún. Lo inicializamos la primera vez que se usa.
let _storage: MMKV | null = null;

const getStorage = (): MMKV => {
  if (!_storage) {
    _storage = createMMKV();
  }
  return _storage;
};

export const CACHE_KEYS = {
  SUBJECTS: 'cache:subjects',
  ASSESSMENTS: 'cache:assessments',
  SCHEDULES: 'cache:schedules',
  PREDICTIONS: 'cache:predictions',
  PROFILE: 'cache:profile',
  GALLERY_ITEMS: 'cache:gallery_items',
  AUDIO_RECORDINGS: 'cache:audio_recordings',
  YOUTUBE_VIDEOS: 'cache:youtube_videos',
  FLASHCARD_DECKS: 'cache:flashcard_decks',
  FLASHCARD_DECKS_WITH_METRICS: 'cache:flashcard_decks_with_metrics',
  PHOTOS_BY_SUBJECT: 'cache:photos_by_subject:',
  SCANNED_DOCUMENTS_BY_SUBJECT: 'cache:scanned_docs_by_subject:',
  FLASHCARDS_BY_DECK: 'cache:flashcards_by_deck:',
  FLASHCARDS_PRIORITIZED_BY_DECK: 'cache:flashcards_prioritized_by_deck:',
  CARDS_NOT_SNOOZED_BY_DECK: 'cache:cards_not_snoozed_by_deck:',
  LAST_SYNC: 'cache:last_sync',
  PROFILE_IMAGE_LOCAL: 'cache:profile_image_local',
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const APP_API_CACHE_PREFIX = 'app_api_cache:';

const CACHE_TTL = {
  SUBJECTS: 1000 * 60 * 60,
  ASSESSMENTS: 1000 * 60 * 60,
  SCHEDULES: 1000 * 60 * 30,
  PREDICTIONS: 1000 * 60 * 15,
  PROFILE: 1000 * 60 * 60 * 24,
  GALLERY_ITEMS: 1000 * 60 * 60,
  AUDIO_RECORDINGS: 1000 * 60 * 60,
  YOUTUBE_VIDEOS: 1000 * 60 * 60,
  FLASHCARD_DECKS: 1000 * 60 * 30,
  FLASHCARD_DECKS_WITH_METRICS: 1000 * 60 * 30,
  PHOTOS_BY_SUBJECT: 1000 * 60 * 60,
  SCANNED_DOCUMENTS_BY_SUBJECT: 1000 * 60 * 60,
  FLASHCARDS_BY_DECK: 1000 * 60 * 30,
  FLASHCARDS_PRIORITIZED_BY_DECK: 1000 * 60 * 15,
  CARDS_NOT_SNOOZED_BY_DECK: 1000 * 60 * 15,
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Cache Functions (Synchronous via MMKV)
// ─────────────────────────────────────────────────────────────────────────────

export const saveToCacheSync = <T>(key: string, data: T): void => {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    getStorage().set(key, JSON.stringify(entry));
  } catch (error) {
    console.warn(`[Cache] ❌ Error guardando ${key}:`, error);
  }
};

export const loadFromCacheSync = <T>(key: string, ttl: number): T | null => {
  try {
    const item = getStorage().getString(key);
    if (!item) return null;

    const entry: CacheEntry<T> = JSON.parse(item);
    const isExpired = Date.now() - entry.timestamp > ttl;

    if (isExpired) {
      // Stale-while-revalidate: devolver datos expirados en lugar de eliminarlos.
      // Cuando el usuario está offline, es mejor mostrar datos antiguos que nada.
      // El store decidirá cuándo refrescar basándose en isCacheEntryExpired().
      console.log(`[Cache] ⚠️ Datos expirados para ${key}, sirviendo stale`);
    }

    return entry.data;
  } catch (error) {
    console.warn(`[Cache] ❌ Error cargando ${key}:`, error);
    return null;
  }
};

export const isCacheEntryExpired = <T>(key: string, ttl: number): boolean => {
  try {
    const item = getStorage().getString(key);
    if (!item) return true;
    const entry: CacheEntry<T> = JSON.parse(item);
    return Date.now() - entry.timestamp > ttl;
  } catch {
    return true;
  }
};

export const clearCacheKeySync = (key: string): void => {
  try {
    getStorage().remove(key);
  } catch (error) {
    console.warn(`[Cache] ❌ Error limpiando ${key}:`, error);
  }
};

export const clearAllCacheSync = (): void => {
  try {
    getStorage().clearAll();
    console.log(`[Cache] 🗑️ Todo el caché limpiado (MMKV)`);
  } catch (error) {
    console.warn(`[Cache] ❌ Error limpiando caché:`, error);
  }
};

export const clearAllData = async (): Promise<void> => {
  clearAllCacheSync();

  try {
    const offlineSync = createMMKV();
    offlineSync.clearAll();
    console.log('[Cache] 🗑️ Cola offline limpiada');
  } catch (e) {
    console.warn('[Cache] Error limpiando cola offline:', e);
  }

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const thresholdKeys = allKeys.filter(k =>
      k.startsWith('@threshold_') || k.startsWith('api_cache_') || k.startsWith('app_api_cache:')
    );
    if (thresholdKeys.length > 0) {
      await AsyncStorage.multiRemove(thresholdKeys);
      console.log(`[Cache] 🗑️ ${thresholdKeys.length} keys de AsyncStorage limpiadas`);
    }
  } catch (e) {
    console.warn('[Cache] Error limpiando AsyncStorage:', e);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Specific Cache Operations
// ─────────────────────────────────────────────────────────────────────────────

export const cacheService = {
  // ── Sync readers for instant UI hydration ──────────────────────────────────
  loadSubjectsSync: () => loadFromCacheSync(CACHE_KEYS.SUBJECTS, CACHE_TTL.SUBJECTS),
  loadAssessmentsSync: () => loadFromCacheSync(CACHE_KEYS.ASSESSMENTS, CACHE_TTL.ASSESSMENTS),
  loadSchedulesSync: () => loadFromCacheSync(CACHE_KEYS.SCHEDULES, CACHE_TTL.SCHEDULES),
  loadPredictionsSync: () => loadFromCacheSync(CACHE_KEYS.PREDICTIONS, CACHE_TTL.PREDICTIONS),
  loadProfileSync: () => loadFromCacheSync(CACHE_KEYS.PROFILE, CACHE_TTL.PROFILE),

  // ── Async wrappers (backwards compatibility, resuelven síncronamente) ───────
  saveSubjects: async (subjects: any[]) => saveToCacheSync(CACHE_KEYS.SUBJECTS, subjects),
  loadSubjects: async () => loadFromCacheSync(CACHE_KEYS.SUBJECTS, CACHE_TTL.SUBJECTS),

  saveAssessments: async (assessments: any[]) => saveToCacheSync(CACHE_KEYS.ASSESSMENTS, assessments),
  loadAssessments: async () => loadFromCacheSync(CACHE_KEYS.ASSESSMENTS, CACHE_TTL.ASSESSMENTS),

  saveSchedules: async (schedules: any[]) => saveToCacheSync(CACHE_KEYS.SCHEDULES, schedules),
  loadSchedules: async () => loadFromCacheSync(CACHE_KEYS.SCHEDULES, CACHE_TTL.SCHEDULES),

  savePredictions: async (predictions: any) => saveToCacheSync(CACHE_KEYS.PREDICTIONS, predictions),
  loadPredictions: async () => loadFromCacheSync(CACHE_KEYS.PREDICTIONS, CACHE_TTL.PREDICTIONS),

  saveProfile: async (profile: any) => saveToCacheSync(CACHE_KEYS.PROFILE, profile),
  loadProfile: async () => loadFromCacheSync(CACHE_KEYS.PROFILE, CACHE_TTL.PROFILE),

  saveGalleryItems: async (items: any[]) => saveToCacheSync(CACHE_KEYS.GALLERY_ITEMS, items),
  loadGalleryItems: async () => loadFromCacheSync(CACHE_KEYS.GALLERY_ITEMS, CACHE_TTL.GALLERY_ITEMS),

  saveAudioRecordings: async (recordings: any[]) => saveToCacheSync(CACHE_KEYS.AUDIO_RECORDINGS, recordings),
  loadAudioRecordings: async () => loadFromCacheSync(CACHE_KEYS.AUDIO_RECORDINGS, CACHE_TTL.AUDIO_RECORDINGS),

  saveYouTubeVideos: async (videos: any[]) => saveToCacheSync(CACHE_KEYS.YOUTUBE_VIDEOS, videos),
  loadYouTubeVideos: async () => loadFromCacheSync(CACHE_KEYS.YOUTUBE_VIDEOS, CACHE_TTL.YOUTUBE_VIDEOS),

  saveFlashcardDecks: async (decks: any[]) => saveToCacheSync(CACHE_KEYS.FLASHCARD_DECKS, decks),
  loadFlashcardDecks: async () => loadFromCacheSync(CACHE_KEYS.FLASHCARD_DECKS, CACHE_TTL.FLASHCARD_DECKS),

  saveFlashcardDecksWithMetrics: async (decks: any[]) => saveToCacheSync(CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS, decks),
  loadFlashcardDecksWithMetrics: async () => loadFromCacheSync(CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS, CACHE_TTL.FLASHCARD_DECKS_WITH_METRICS),

  savePhotosBySubject: async (subjectId: number, photos: any[]) => saveToCacheSync(`${CACHE_KEYS.PHOTOS_BY_SUBJECT}${subjectId}`, photos),
  loadPhotosBySubject: async (subjectId: number) => loadFromCacheSync(`${CACHE_KEYS.PHOTOS_BY_SUBJECT}${subjectId}`, CACHE_TTL.PHOTOS_BY_SUBJECT),

  saveScannedDocumentsBySubject: async (subjectId: number, docs: any[]) => saveToCacheSync(`${CACHE_KEYS.SCANNED_DOCUMENTS_BY_SUBJECT}${subjectId}`, docs),
  loadScannedDocumentsBySubject: async (subjectId: number) => loadFromCacheSync(`${CACHE_KEYS.SCANNED_DOCUMENTS_BY_SUBJECT}${subjectId}`, CACHE_TTL.SCANNED_DOCUMENTS_BY_SUBJECT),

  saveFlashcardsByDeck: async (deckId: number, cards: any[]) => saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`, cards),
  loadFlashcardsByDeck: async (deckId: number) => loadFromCacheSync(`${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`, CACHE_TTL.FLASHCARDS_BY_DECK),

  saveFlashcardsPrioritizedByDeck: async (deckId: number, cards: any[]) => saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, cards),
  loadFlashcardsPrioritizedByDeck: async (deckId: number) => loadFromCacheSync(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, CACHE_TTL.FLASHCARDS_PRIORITIZED_BY_DECK),

  saveCardsNotSnoozedByDeck: async (deckId: number, cards: any[]) => saveToCacheSync(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, cards),
  loadCardsNotSnoozedByDeck: async (deckId: number) => loadFromCacheSync(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, CACHE_TTL.CARDS_NOT_SNOOZED_BY_DECK),

  saveLastSync: async () => getStorage().set(CACHE_KEYS.LAST_SYNC, Date.now().toString()),
  getLastSync: async () => {
    const ts = getStorage().getString(CACHE_KEYS.LAST_SYNC);
    if (!ts) return 0;
    const parsed = parseInt(ts);
    if (Date.now() - parsed > 30 * 24 * 60 * 60 * 1000) return 0; // expira tras 30 días
    return parsed;
  },

  saveLocalProfileImage: (localUri: string) => saveToCacheSync(CACHE_KEYS.PROFILE_IMAGE_LOCAL, localUri),
  getLocalProfileImage: () => loadFromCacheSync<string>(CACHE_KEYS.PROFILE_IMAGE_LOCAL, Infinity),
  getLocalProfileImageTimestamp: () => {
    try {
      const raw = getStorage().getString(CACHE_KEYS.PROFILE_IMAGE_LOCAL);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CacheEntry<string>;
      return entry.timestamp || null;
    } catch { return null; }
  },

  clearKey: (key: string) => clearCacheKeySync(key),

  clear: async () => clearAllData(),
};
