/**
 * flashcards.ts
 *
 * Servicio CRUD completo para el módulo de Flashcards.
 * Gestiona mazos (`FlashcardDeck`) y tarjetas individuales (`Flashcard`),
 * incluyendo la generación automática vía LLM (desde texto o imagen base64),
 * el sistema de repetición espaciada (actualización de estado new/learning/review)
 * y el intercambio colaborativo de mazos mediante PIN de usuario.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { FlashcardDeck, Flashcard } from './types';
import { cacheService, CACHE_KEYS } from '../../services/cacheService';

/** Obtiene todos los mazos del usuario autenticado, incluyendo los recibidos por colaboración */
export const getFlashcardDecks = async (): Promise<FlashcardDeck[]> => {
  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(`/flashcard-decks?user_id=${userId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al obtener los mazos');
    }
    // Cache the result on success
    if (data && Array.isArray(data)) {
      await cacheService.saveFlashcardDecks(data);
    }
    return data || [];
  } catch (error) {
    // Fallback to cache on error
    console.warn('[Flashcards] Network error, attempting to load from cache:', error);
    const cached: FlashcardDeck[] | null = await cacheService.loadFlashcardDecks() as FlashcardDeck[] | null;
    if (cached) {
      console.log('[Flashcards] ✅ Loaded decks from cache (offline mode)');
      return cached;
    }
    throw error;
  }
};

/** Obtiene todos los mazos con métricas de prioridad, ordenados por urgencia */
export const getFlashcardDecksWithMetrics = async (): Promise<FlashcardDeck[]> => {
  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(`/flashcard-decks/with-metrics?user_id=${userId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al obtener los mazos con métricas');
    }
    // Cache the result on success
    if (data && Array.isArray(data)) {
      await cacheService.saveFlashcardDecksWithMetrics(data);
    }
    return data || [];
  } catch (error) {
    // Fallback to cache on error
    console.warn('[Flashcards] Network error, attempting to load metrics from cache:', error);
    const cached: FlashcardDeck[] | null = await cacheService.loadFlashcardDecksWithMetrics() as FlashcardDeck[] | null;
    if (cached) {
      console.log('[Flashcards] ✅ Loaded decks with metrics from cache (offline mode)');
      return cached;
    }
    throw error;
  }
};

/** Crea un nuevo mazo vacío vinculado a una materia (opcional). Inyecta automáticamente el `user_id` */
export const createFlashcardDeck = async (payload: { subject_id?: number; title: string; description?: string }) => {
  const userId = await getUserId();
  const payloadWithUser = { ...payload, user_id: userId };
  
  const response = await fetchWithFallback('/flashcard-decks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadWithUser),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al crear el mazo');
  return data;
};

/** Actualiza un mazo de flashcards (subject_id, title, description) */
export const updateFlashcardDeck = async (deckId: number, payload: { subject_id?: number; title?: string; description?: string }) => {
  const response = await fetchWithFallback(`/flashcard-decks/${deckId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al actualizar el mazo');
  return data;
};

/** Obtiene todas las tarjetas de un mazo específico por su ID */
export const getFlashcards = async (deckId: number): Promise<Flashcard[]> => {
  try {
    const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al obtener tarjetas');
    }
    // Cache the result on success
    if (data && Array.isArray(data)) {
      await cacheService.saveFlashcardsByDeck(deckId, data);
    }
    return data || [];
  } catch (error) {
    // Fallback to cache on error
    console.warn(`[Flashcards] Network error getting cards for deck ${deckId}, attempting cache:`, error);
    const cached: Flashcard[] | null = await cacheService.loadFlashcardsByDeck(deckId) as Flashcard[] | null;
    if (cached) {
      console.log(`[Flashcards] ✅ Loaded ${cached.length} cards from cache (offline mode)`);
      return cached;
    }
    throw error;
  }
};

/** Obtiene todas las tarjetas de un mazo ordenadas por prioridad de repaso */
export const getFlashcardsPrioritized = async (deckId: number): Promise<Flashcard[]> => {
  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards/prioritized?userId=${userId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al obtener tarjetas priorizadas');
    }
    // Cache the result on success
    if (data && Array.isArray(data)) {
      await cacheService.saveFlashcardsPrioritizedByDeck(deckId, data);
    }
    return data || [];
  } catch (error) {
    // Fallback to cache on error
    console.warn(`[Flashcards] Network error getting prioritized cards for deck ${deckId}, attempting cache:`, error);
    const cached: Flashcard[] | null = await cacheService.loadFlashcardsPrioritizedByDeck(deckId) as Flashcard[] | null;
    if (cached) {
      console.log(`[Flashcards] ✅ Loaded ${cached.length} prioritized cards from cache (offline mode)`);
      return cached;
    }
    throw error;
  }
};

/** Obtiene una tarjeta específica por su ID */
export const getCardById = async (cardId: number): Promise<Flashcard> => {
  const response = await fetchWithFallback(`/flashcards/${cardId}`);
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al obtener tarjeta');
  return data;
};

/** Crea una tarjeta manualmente en un mazo con su texto de frente y reverso */
export const createFlashcard = async (payload: { deck_id: number; front: string; back: string }) => {
  const response = await fetchWithFallback(`/flashcard-decks/${payload.deck_id}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al crear tarjeta');
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_BY_DECK + payload.deck_id);
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK + payload.deck_id);
  cacheService.clearKey(CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK + payload.deck_id);
  return data;
};

/** Crea un evaluation item (flashcard, multiple_choice, o boolean) con estructura polimórfica */
export const createEvaluationItem = async (payload: { 
  deck_id: number; 
  item_type: 'flashcard' | 'multiple_choice' | 'boolean'; 
  content_json: any;
  hint?: string;
  explanation?: string;
}) => {
  const response = await fetchWithFallback(`/flashcard-decks/${payload.deck_id}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al crear ítem');
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_BY_DECK + payload.deck_id);
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK + payload.deck_id);
  cacheService.clearKey(CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK + payload.deck_id);
  return data;
};

/**
 * Actualiza el estado de repaso de una tarjeta según la calificación del alumno.
 * @param status - Nuevo estado: 'new' | 'learning' | 'review'
 */
export const updateFlashcardStatus = async (cardId: number, status: string) => {
  const response = await fetchWithFallback(`/flashcards/${cardId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return await parseJsonSafely(response);
};

/**
 * Genera un mazo completo de flashcards usando el LLM (Groq) a partir de texto.
 * El texto fuente suele ser una transcripción o resumen académico.
 */
export const generateFlashcardsFromText = async (payload: {
  text: string;
  count: number;
  title: string;
  subject_id: number;
  user_id: number;
  mode?: string;
}) => {
  const response = await fetchWithFallback('/flashcard-decks/generate-from-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error generating flashcards');
  return data;
};

/**
 * Genera un mazo de flashcards usando Groq Vision a partir de una imagen base64.
 * Ideal para documentos escaneados o capturas de pizarrón/diapositivas.
 */
export const generateFlashcardsFromImage = async (payload: {
  image_base64: string;
  count: number;
  title: string;
  subject_id: number;
  user_id: number;
  mode?: string;
}) => {
  const response = await fetchWithFallback('/flashcard-decks/generate-from-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error generating flashcards from image');
  return data;
};

/**
 * Comparte una copia de un mazo con otro usuario mediante su PIN único.
 * @param deckId - ID del mazo a compartir.
 * @param recipientPin - PIN del usuario destinatario (case-insensitive, se normaliza a mayúsculas).
 */
export const shareDeck = async (deckId: number, options: { recipientPin?: string; groupPinId?: string }): Promise<{ message: string; recipient_name?: string }> => {
  const userId = await getUserId();
  const body: Record<string, any> = { user_id: userId };
  if (options.recipientPin) body.recipient_pin = options.recipientPin.trim().toUpperCase();
  if (options.groupPinId) body.group_pin_id = options.groupPinId;
  const response = await fetchWithFallback(`/flashcard-decks/${deckId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al compartir el mazo');
  return data;
};

/** Elimina un mazo completo o quita un mazo compartido de la lista */
export const deleteFlashcardDeck = async (deckId: number) => {
  const userId = await getUserId();
  const response = await fetchWithFallback(`/flashcard-decks/${deckId}?user_id=${userId}`, {
    method: 'DELETE',
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al eliminar el mazo');
  cacheService.clearKey(CACHE_KEYS.FLASHCARD_DECKS);
  cacheService.clearKey(CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS);
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_BY_DECK + deckId);
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK + deckId);
  cacheService.clearKey(CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK + deckId);
  return data;
};



// ─────────────────────────────────────────────────────────────────────────────
// Snooze Management
// ─────────────────────────────────────────────────────────────────────────────

export interface SnoozeStatus {
  isSnoozed: boolean;
  cardId: number;
  resumeAt?: string;
  durationMinutes?: number;
  reason?: string;
  timeUntilResume?: number; // in minutes
  wasExpired?: boolean;
}

/**
 * Snooze a card for a specified duration
 * @param cardId - ID de la tarjeta a snoozar
 * @param durationMinutes - Duración en minutos (30, 240, 1440, 4320)
 * @param reason - Razón opcional del snooze
 */
export const snoozeCard = async (
  cardId: number,
  durationMinutes: number,
  reason?: string
): Promise<{ success: boolean; snoozedUntil: string }> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcards/${cardId}/snooze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, durationMinutes, reason }),
    }
  );
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al snoozar tarjeta');
  return data;
};

/**
 * Reanuda (unsnooza) una tarjeta
 */
export const unsnoozeCard = async (cardId: number): Promise<{ success: boolean }> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcards/${cardId}/snooze?userId=${userId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al reanudar tarjeta');
  return data;
};

/**
 * Obtiene el estado de snooze de una tarjeta
 */
export const getSnoozeStatus = async (cardId: number): Promise<SnoozeStatus> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcards/${cardId}/snooze-status?userId=${userId}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al obtener estado de snooze');
  return data;
};

/**
 * Obtiene tarjetas de un mazo excluyendo las snoozed
 */
export const getCardsNotSnoozed = async (deckId: number): Promise<Flashcard[]> => {
  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(
      `/flashcard-decks/${deckId}/cards/not-snoozed?userId=${userId}`
    );
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al obtener tarjetas no snoozadas');
    }
    // Cache the result on success
    if (data && Array.isArray(data)) {
      await cacheService.saveCardsNotSnoozedByDeck(deckId, data);
    }
    return data || [];
  } catch (error) {
    // Fallback to cache on error
    console.warn(`[Flashcards] Network error getting non-snoozed cards for deck ${deckId}, attempting cache:`, error);
    const cached: Flashcard[] | null = await cacheService.loadCardsNotSnoozedByDeck(deckId) as Flashcard[] | null;
    if (cached) {
      console.log(`[Flashcards] ✅ Loaded ${cached.length} non-snoozed cards from cache (offline mode)`);
      return cached;
    }
    throw error;
  }
};

/**
 * Reanuda automáticamente todas las tarjetas snoozed expiradas
 */
export const autoUnsnoozeExpired = async (): Promise<{ success: boolean; resumedCount: number }> => {
  const userId = await getUserId();
  const response = await fetchWithFallback('/flashcards/auto-unsnoozed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al reanudar tarjetas expiradas');
  return data;
};

/** Elimina una tarjeta individual de un mazo por su ID */
export const deleteFlashcard = async (cardId: number) => {
  const response = await fetchWithFallback(`/flashcards/${cardId}`, {
    method: 'DELETE',
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al eliminar la tarjeta');
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_BY_DECK);
  cacheService.clearKey(CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK);
  cacheService.clearKey(CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK);
  return data;
};
