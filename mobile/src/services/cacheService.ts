import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio de caché persistente para datos críticos de la app.
 * Utiliza AsyncStorage para guardar/cargar datos del dispositivo.
 * Permite cargar datos instantáneamente al reabrirse la app.
 */

const CACHE_KEYS = {
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
  // Dinámicas por subject/deck ID
  PHOTOS_BY_SUBJECT: 'cache:photos_by_subject:',
  SCANNED_DOCUMENTS_BY_SUBJECT: 'cache:scanned_docs_by_subject:',
  FLASHCARDS_BY_DECK: 'cache:flashcards_by_deck:',
  FLASHCARDS_PRIORITIZED_BY_DECK: 'cache:flashcards_prioritized_by_deck:',
  CARDS_NOT_SNOOZED_BY_DECK: 'cache:cards_not_snoozed_by_deck:',
  LAST_SYNC: 'cache:last_sync',
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = {
  SUBJECTS: 1000 * 60 * 60, // 1 hora
  ASSESSMENTS: 1000 * 60 * 60, // 1 hora
  SCHEDULES: 1000 * 60 * 30, // 30 minutos
  PREDICTIONS: 1000 * 60 * 15, // 15 minutos
  PROFILE: 1000 * 60 * 60 * 24, // 24 horas
  GALLERY_ITEMS: 1000 * 60 * 60, // 1 hora
  AUDIO_RECORDINGS: 1000 * 60 * 60, // 1 hora
  YOUTUBE_VIDEOS: 1000 * 60 * 60, // 1 hora
  FLASHCARD_DECKS: 1000 * 60 * 30, // 30 minutos
  FLASHCARD_DECKS_WITH_METRICS: 1000 * 60 * 30, // 30 minutos
  PHOTOS_BY_SUBJECT: 1000 * 60 * 60, // 1 hora
  SCANNED_DOCUMENTS_BY_SUBJECT: 1000 * 60 * 60, // 1 hora
  FLASHCARDS_BY_DECK: 1000 * 60 * 30, // 30 minutos
  FLASHCARDS_PRIORITIZED_BY_DECK: 1000 * 60 * 15, // 15 minutos
  CARDS_NOT_SNOOZED_BY_DECK: 1000 * 60 * 15, // 15 minutos
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Cache Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guarda datos en caché con timestamp
 */
export const saveToCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
    console.log(`[Cache] ✅ Guardado: ${key}`);
  } catch (error) {
    console.warn(`[Cache] ❌ Error guardando ${key}:`, error);
  }
};

/**
 * Carga datos del caché si están disponibles y no han expirado
 */
export const loadFromCache = async <T>(key: string, ttl: number): Promise<T | null> => {
  try {
    const item = await AsyncStorage.getItem(key);
    if (!item) return null;

    const entry: CacheEntry<T> = JSON.parse(item);
    const isExpired = Date.now() - entry.timestamp > ttl;

    if (isExpired) {
      console.log(`[Cache] ⏰ Expirado: ${key}`);
      await AsyncStorage.removeItem(key);
      return null;
    }

    console.log(`[Cache] ✅ Cargado: ${key}`);
    return entry.data;
  } catch (error) {
    console.warn(`[Cache] ❌ Error cargando ${key}:`, error);
    return null;
  }
};

/**
 * Limpia un elemento del caché
 */
export const clearCacheKey = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
    console.log(`[Cache] 🗑️ Limpiado: ${key}`);
  } catch (error) {
    console.warn(`[Cache] ❌ Error limpiando ${key}:`, error);
  }
};

/**
 * Limpia todo el caché
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = Object.values(CACHE_KEYS);
    await AsyncStorage.multiRemove(keys);
    console.log(`[Cache] 🗑️ Todo el caché limpiado`);
  } catch (error) {
    console.warn(`[Cache] ❌ Error limpiando caché:`, error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Specific Cache Operations
// ─────────────────────────────────────────────────────────────────────────────

export const cacheService = {
  // Subjects
  saveSubjects: (subjects: any[]) => saveToCache(CACHE_KEYS.SUBJECTS, subjects),
  loadSubjects: () => loadFromCache(CACHE_KEYS.SUBJECTS, CACHE_TTL.SUBJECTS),

  // Assessments
  saveAssessments: (assessments: any[]) => saveToCache(CACHE_KEYS.ASSESSMENTS, assessments),
  loadAssessments: () => loadFromCache(CACHE_KEYS.ASSESSMENTS, CACHE_TTL.ASSESSMENTS),

  // Schedules
  saveSchedules: (schedules: any[]) => saveToCache(CACHE_KEYS.SCHEDULES, schedules),
  loadSchedules: () => loadFromCache(CACHE_KEYS.SCHEDULES, CACHE_TTL.SCHEDULES),

  // Predictions
  savePredictions: (predictions: any) => saveToCache(CACHE_KEYS.PREDICTIONS, predictions),
  loadPredictions: () => loadFromCache(CACHE_KEYS.PREDICTIONS, CACHE_TTL.PREDICTIONS),

  // Profile
  saveProfile: (profile: any) => saveToCache(CACHE_KEYS.PROFILE, profile),
  loadProfile: () => loadFromCache(CACHE_KEYS.PROFILE, CACHE_TTL.PROFILE),

  // Gallery Items
  saveGalleryItems: (items: any[]) => saveToCache(CACHE_KEYS.GALLERY_ITEMS, items),
  loadGalleryItems: () => loadFromCache(CACHE_KEYS.GALLERY_ITEMS, CACHE_TTL.GALLERY_ITEMS),

  // Audio Recordings
  saveAudioRecordings: (recordings: any[]) => saveToCache(CACHE_KEYS.AUDIO_RECORDINGS, recordings),
  loadAudioRecordings: () => loadFromCache(CACHE_KEYS.AUDIO_RECORDINGS, CACHE_TTL.AUDIO_RECORDINGS),

  // YouTube Videos
  saveYouTubeVideos: (videos: any[]) => saveToCache(CACHE_KEYS.YOUTUBE_VIDEOS, videos),
  loadYouTubeVideos: () => loadFromCache(CACHE_KEYS.YOUTUBE_VIDEOS, CACHE_TTL.YOUTUBE_VIDEOS),

  // Flashcard Decks
  saveFlashcardDecks: (decks: any[]) => saveToCache(CACHE_KEYS.FLASHCARD_DECKS, decks),
  loadFlashcardDecks: () => loadFromCache(CACHE_KEYS.FLASHCARD_DECKS, CACHE_TTL.FLASHCARD_DECKS),

  // Flashcard Decks with Metrics
  saveFlashcardDecksWithMetrics: (decks: any[]) => saveToCache(CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS, decks),
  loadFlashcardDecksWithMetrics: () => loadFromCache(CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS, CACHE_TTL.FLASHCARD_DECKS_WITH_METRICS),

  // Photos by Subject (dinámico por subject ID)
  savePhotosBySubject: (subjectId: number, photos: any[]) => saveToCache(`${CACHE_KEYS.PHOTOS_BY_SUBJECT}${subjectId}`, photos),
  loadPhotosBySubject: (subjectId: number) => loadFromCache(`${CACHE_KEYS.PHOTOS_BY_SUBJECT}${subjectId}`, CACHE_TTL.PHOTOS_BY_SUBJECT),

  // Scanned Documents by Subject (dinámico por subject ID)
  saveScannedDocumentsBySubject: (subjectId: number, docs: any[]) => saveToCache(`${CACHE_KEYS.SCANNED_DOCUMENTS_BY_SUBJECT}${subjectId}`, docs),
  loadScannedDocumentsBySubject: (subjectId: number) => loadFromCache(`${CACHE_KEYS.SCANNED_DOCUMENTS_BY_SUBJECT}${subjectId}`, CACHE_TTL.SCANNED_DOCUMENTS_BY_SUBJECT),

  // Flashcards by Deck (dinámico por deck ID)
  saveFlashcardsByDeck: (deckId: number, cards: any[]) => saveToCache(`${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`, cards),
  loadFlashcardsByDeck: (deckId: number) => loadFromCache(`${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`, CACHE_TTL.FLASHCARDS_BY_DECK),

  // Flashcards Prioritized by Deck (dinámico por deck ID)
  saveFlashcardsPrioritizedByDeck: (deckId: number, cards: any[]) => saveToCache(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, cards),
  loadFlashcardsPrioritizedByDeck: (deckId: number) => loadFromCache(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, CACHE_TTL.FLASHCARDS_PRIORITIZED_BY_DECK),

  // Cards Not Snoozed by Deck (dinámico por deck ID)
  saveCardsNotSnoozedByDeck: (deckId: number, cards: any[]) => saveToCache(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, cards),
  loadCardsNotSnoozedByDeck: (deckId: number) => loadFromCache(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, CACHE_TTL.CARDS_NOT_SNOOZED_BY_DECK),

  // Sync timestamp
  saveLastSync: () => AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString()),
  getLastSync: async () => {
    const ts = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
    return ts ? parseInt(ts) : 0;
  },

  // Clear everything
  clear: clearAllCache,
};
