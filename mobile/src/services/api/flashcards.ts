import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { FlashcardDeck, Flashcard } from './types';
import { flashcardDeckRepository, flashcardRepository, syncService } from '../database';

export const getFlashcardDecks = async (): Promise<FlashcardDeck[]> => {
  // 1. Leer localmente primero
  const localData = await flashcardDeckRepository.getAll();

  if (!localData || localData.length === 0) {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks?user_id=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const d of data) await flashcardDeckRepository.upsert(d);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en background
  (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks?user_id=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const d of data) await flashcardDeckRepository.upsert(d);
        }
      }
    } catch {}
  })();

  return localData;
};

export const getFlashcardDecksWithMetrics = async (): Promise<FlashcardDeck[]> => {
  // 1. Leer localmente primero
  const localData = await flashcardDeckRepository.getAll();

  if (!localData || localData.length === 0) {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks/with-metrics?user_id=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const d of data) await flashcardDeckRepository.upsert(d);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en background
  (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks/with-metrics?user_id=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const d of data) await flashcardDeckRepository.upsert(d);
        }
      }
    } catch {}
  })();

  return localData;
};

export const createFlashcardDeck = async (payload: { subject_id?: string; title: string; description?: string }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = (payload as any).id || uuidv4();

  const deck: any = { id, ...payload, card_count: 0, created_at: new Date().toISOString() };
  await flashcardDeckRepository.create(deck);

  try {
    const response = await fetchWithFallback('/flashcard-decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await flashcardDeckRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('flashcard-deck', id, { ...payload, id });
    return deck;
  }
};

export const updateFlashcardDeck = async (deckId: string, payload: any): Promise<any> => {
  await flashcardDeckRepository.update(deckId, payload);

  try {
    const response = await fetchWithFallback(`/flashcard-decks/${deckId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await flashcardDeckRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error al actualizar el mazo');
  } catch {
    await syncService.enqueueUpdate('flashcard-deck', deckId, payload);
    return { ...payload, _isPending: true };
  }
};

export const getFlashcards = async (deckId: string): Promise<Flashcard[]> => {
  // 1. Leer localmente primero
  const localData = await flashcardRepository.getByDeck(deckId);

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) await flashcardRepository.upsert(c);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const getFlashcardsPrioritized = async (deckId: string): Promise<Flashcard[]> => {
  // 1. Leer localmente primero
  const localData = await flashcardRepository.getByDeck(deckId);

  // 2. Sincronizar en background
  (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards/prioritized?userId=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) await flashcardRepository.upsert(c);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const getCardById = async (cardId: string): Promise<Flashcard> => {
  const response = await fetchWithFallback(`/flashcards/${cardId}`);
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al obtener tarjeta');
  return data;
};

export const createFlashcard = async (payload: { deck_id: string; front: string; back: string; id?: string }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();
  const card: any = { id, ...payload, status: 'new', created_at: new Date().toISOString() };

  await flashcardRepository.create(card);

  try {
    const response = await fetchWithFallback(`/flashcard-decks/${payload.deck_id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await flashcardRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error al crear tarjeta');
  } catch {
    await syncService.enqueueCreate('flashcard', id, { ...payload, id });
    return card;
  }
};

export const createEvaluationItem = async (payload: { deck_id: string; item_type: 'flashcard' | 'multiple_choice' | 'boolean'; content_json: any; hint?: string; explanation?: string; id?: string }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();
  const item: any = { id, deck_id: payload.deck_id, status: 'new', created_at: new Date().toISOString(), ...payload };

  await flashcardRepository.create(item);

  try {
    const response = await fetchWithFallback(`/flashcard-decks/${payload.deck_id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await flashcardRepository.upsert(data);
      return data;
    }
    throw new Error(data?.error || 'Error al crear ítem');
  } catch {
    await syncService.enqueueCreate('evaluation-item', id, { ...payload, id });
    return item;
  }
};

export const updateFlashcardStatus = async (cardId: string, status: string) => {
  await flashcardRepository.update(cardId, { status } as any);

  try {
    const response = await fetchWithFallback(`/flashcards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueUpdate('flashcard', cardId, { status });
    return { success: true, status, _isPending: true };
  }
};

export const generateFlashcardsFromText = async (payload: any) => {
  const response = await fetchWithFallback('/flashcard-decks/generate-from-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error generating flashcards');
  return data;
};

export const generateFlashcardsFromImage = async (payload: any) => {
  const response = await fetchWithFallback('/flashcard-decks/generate-from-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error generating flashcards from image');
  return data;
};

export const shareDeck = async (deckId: string, options: { recipientPin?: string; groupPinId?: string }) => {
  const userId = await getUserId();
  const body: any = { user_id: userId };
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

export const removeDeckFromGroup = async (deckId: string, groupPinId: string): Promise<any> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(`/flashcard-decks/${deckId}/group-share`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, group_pin_id: groupPinId }),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al eliminar el mazo del grupo');
  return data;
};

export const deleteFlashcardDeck = async (deckId: string) => {
  await flashcardDeckRepository.delete(deckId);

  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(`/flashcard-decks/${deckId}?user_id=${userId}`, { method: 'DELETE' });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('flashcard-deck', deckId);
    return { success: true, _isPending: true };
  }
};

export interface SnoozeStatus {
  isSnoozed: boolean;
  cardId: string;
  resumeAt?: string;
  durationMinutes?: number;
  reason?: string;
  timeUntilResume?: number;
  wasExpired?: boolean;
}

export const snoozeCard = async (cardId: string, durationMinutes: number, reason?: string): Promise<any> => {
  const userId = await getUserId().catch(() => null);
  try {
    const response = await fetchWithFallback(`/flashcards/${cardId}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, durationMinutes, reason }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error al snoozar tarjeta');
    return data;
  } catch {
    await syncService.enqueueCreate('card-snooze', cardId, { userId: userId || undefined, durationMinutes, reason });
    const snoozedUntil = new Date(Date.now() + durationMinutes * 60000).toISOString();
    return { success: true, snoozedUntil, _isPending: true };
  }
};

export const unsnoozeCard = async (cardId: string): Promise<any> => {
  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(`/flashcards/${cardId}/snooze?userId=${userId}`, { method: 'DELETE' });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error al reanudar tarjeta');
    return data;
  } catch {
    await syncService.enqueueDelete('card-snooze', cardId);
    return { success: true, _isPending: true };
  }
};

export const getSnoozeStatus = async (cardId: string): Promise<SnoozeStatus> => {
  const userId = await getUserId();
  const response = await fetchWithFallback(`/flashcards/${cardId}/snooze-status?userId=${userId}`);
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data?.error || 'Error al obtener estado de snooze');
  return data;
};

export const getCardsNotSnoozed = async (deckId: string): Promise<Flashcard[]> => {
  // 1. Leer localmente primero
  const localData = await flashcardRepository.getByDeck(deckId);

  // 2. Sincronizar en background
  (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards/not-snoozed?userId=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) await flashcardRepository.upsert(c);
        }
      }
    } catch {}
  })();

  return localData || [];
};

export const autoUnsnoozeExpired = async (): Promise<any> => {
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

export const deleteFlashcard = async (cardId: string) => {
  await flashcardRepository.delete(cardId);

  try {
    const response = await fetchWithFallback(`/flashcards/${cardId}`, { method: 'DELETE' });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('flashcard', cardId);
    return { success: true, _isPending: true };
  }
};
