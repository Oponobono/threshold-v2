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

/** Obtiene todos los mazos del usuario autenticado, incluyendo los recibidos por colaboración */
export const getFlashcardDecks = async (): Promise<FlashcardDeck[]> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(`/flashcard-decks?user_id=${userId}`);
  return (await parseJsonSafely(response)) || [];
};

/** Obtiene todos los mazos con métricas de prioridad, ordenados por urgencia */
export const getFlashcardDecksWithMetrics = async (): Promise<FlashcardDeck[]> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(`/flashcard-decks/with-metrics?user_id=${userId}`);
  return (await parseJsonSafely(response)) || [];
};

/** Crea un nuevo mazo vacío vinculado a una materia. Inyecta automáticamente el `user_id` */
export const createFlashcardDeck = async (payload: { subject_id: number; title: string; description?: string }) => {
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

/** Obtiene todas las tarjetas de un mazo específico por su ID */
export const getFlashcards = async (deckId: number): Promise<Flashcard[]> => {
  const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards`);
  return (await parseJsonSafely(response)) || [];
};

/** Obtiene todas las tarjetas de un mazo ordenadas por prioridad de repaso */
export const getFlashcardsPrioritized = async (deckId: number): Promise<Flashcard[]> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards/prioritized?userId=${userId}`);
  return (await parseJsonSafely(response)) || [];
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
export const shareDeck = async (deckId: number, recipientPin: string): Promise<{ message: string; recipient_name: string }> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(`/flashcard-decks/${deckId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, recipient_pin: recipientPin.trim().toUpperCase() }),
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
  return data;
};

/**
 * Analiza confusiones en un mazo: detecta tarjetas que se confunden frecuentemente
 * Retorna pares de tarjetas con correlación de errores
 */
export const analyzeDeckConfusions = async (deckId: number) => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcard-decks/${deckId}/analyze-confusions?userId=${userId}`
  );
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al analizar confusiones');
  return data;
};

/**
 * Genera una tarjeta de diferenciación entre dos conceptos confusos
 * Utiliza Groq para generar contenido pedagógico
 */
export const generateDifferentiationCard = async (
  deckId: number,
  card1_id: number,
  card2_id: number
) => {
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcard-decks/${deckId}/generate-differentiation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card1_id, card2_id, userId }),
    }
  );
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error generando tarjeta de diferenciación');
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
  const userId = await getUserId();
  const response = await fetchWithFallback(
    `/flashcard-decks/${deckId}/cards/not-snoozed?userId=${userId}`
  );
  return (await parseJsonSafely(response)) || [];
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
  return data;
};
