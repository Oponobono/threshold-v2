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

/** Elimina una tarjeta individual de un mazo por su ID */
export const deleteFlashcard = async (cardId: number) => {
  const response = await fetchWithFallback(`/flashcards/${cardId}`, {
    method: 'DELETE',
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al eliminar la tarjeta');
  return data;
};
