import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import type { FlashcardDeck, Flashcard, CardDirection } from './types';
import { flashcardDeckRepository, flashcardRepository, syncService } from '../database';
import { requireActiveSubject, requireActiveFlashcardDeck } from '../domain/invariants';

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
          for (const d of data) await flashcardDeckRepository.upsertFromCloud(d);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en background (solo crea registros nuevos, nunca sobreescribe)
  (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks?user_id=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const d of data) await flashcardDeckRepository.upsertFromCloud(d);
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
          for (const d of data) await flashcardDeckRepository.upsertFromCloud(d);
          return data;
        }
      }
    } catch {}
    return [];
  }

  // 2. Sincronizar en foreground para devolver la data fresca
  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(`/flashcard-decks/with-metrics?user_id=${userId}`);
    if (response.ok) {
      const data = await parseJsonSafely(response);
      if (Array.isArray(data)) {
        for (const d of data) {
          try {
            const { databaseService } = await import('../database/DatabaseService');
            await databaseService.getDb().runAsync(
              `UPDATE flashcard_decks 
               SET card_count = ?, review_count = ?, learning_count = ?, new_count = ?
               WHERE id = ?`,
              [d.card_count ?? 0, d.review_count ?? 0, d.learning_count ?? 0, d.new_count ?? 0, d.id]
            );
          } catch (e) {
            console.warn('[Flashcards API] Error actualizando métricas:', e);
          }
          await flashcardDeckRepository.upsertFromCloud(d);
        }
        const remoteIds = new Set(data.map(d => String(d.id)));
        const localOnly = localData.filter(ld => !remoteIds.has(String(ld.id)));
        return [...data, ...localOnly];
      }
    }
  } catch {}

  return localData;
};

export const createFlashcardDeck = async (payload: { subject_id?: string; title: string; description?: string; id?: string; linked_event_id?: string; avg_ease_factor?: number; total_reviews?: number; last_reviewed_at?: string; card_count?: number }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = (payload as any).id || uuidv4();
  const userId = await getUserId();

  if (payload.subject_id) {
    await requireActiveSubject(payload.subject_id);
  }

  const deck: any = { id, user_id: userId, ...payload, card_count: payload.card_count ?? 0, created_at: new Date().toISOString() };
  await flashcardDeckRepository.create(deck);

  try {
    const response = await fetchWithFallback('/flashcard-decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      const merged = await mergeDeckWithLocal(data);
      await flashcardDeckRepository.update(data.id, merged);
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('flashcard-deck', id, { ...payload, id });
    return deck;
  }
};

const mergeDeckWithLocal = async (serverDeck: any): Promise<any> => {
  const localRecord = await flashcardDeckRepository.getById(serverDeck.id);
  const merged = { ...serverDeck };

  if (localRecord) {
    // Usar !== undefined para distinguir entre:
    //   - servidor devuelve null  → desvinculación explícita, respetar
    //   - servidor no incluye el campo (undefined) → preservar local
    merged.subject_id = serverDeck.subject_id !== undefined
      ? serverDeck.subject_id
      : (localRecord.subject_id ?? null);
    merged.subject_name = serverDeck.subject_name !== undefined
      ? serverDeck.subject_name
      : (localRecord.subject_name ?? null);
    merged.subject_color = serverDeck.subject_color !== undefined
      ? serverDeck.subject_color
      : (localRecord.subject_color ?? null);
    merged.subject_icon = serverDeck.subject_icon !== undefined
      ? serverDeck.subject_icon
      : (localRecord.subject_icon ?? null);
    merged.linked_event_id = serverDeck.linked_event_id !== undefined
      ? serverDeck.linked_event_id
      : (localRecord.linked_event_id ?? null);
  }

  // Si tenemos subject_id pero nos faltan los metadatos visuales, hidratar desde SQLite local
  if (!merged.subject_name && merged.subject_id) {
    try {
      const { databaseService } = await import('../database/DatabaseService');
      const subject: any = await databaseService.getDb().getFirstAsync('SELECT name, color, icon FROM subjects WHERE id = ? AND deleted_at IS NULL', [merged.subject_id]);
      if (subject) {
        merged.subject_name = subject.name;
        merged.subject_color = subject.color;
        merged.subject_icon = subject.icon;
      }
    } catch (e) {
      console.warn('Error resolviendo subject local:', e);
    }
  }

  return merged;
};

export const updateFlashcardDeck = async (deckId: string, payload: any): Promise<any> => {
  await flashcardDeckRepository.update(deckId, { ...payload, is_backed_up: 0 });

  syncService.enqueueUpdate('flashcard-deck', deckId, payload).catch(() => {});
  return { ...payload, id: deckId, _isPending: true };
};

function getLocalCardsFromMMKV(deckId: string): any[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkv = require('react-native-mmkv').createMMKV();
    const raw = mmkv.getString(`cache:flashcards_by_deck:${deckId}`);
    if (raw) {
      const entry = JSON.parse(raw);
      return entry.data || entry || [];
    }
  } catch {}
  return [];
}

function mergeCards(database: any[], mmkv: any[]): any[] {
  const seen = new Set(database.map(c => String(c.id)));
  return [...database, ...mmkv.filter(c => !seen.has(String(c.id)))];
}

export const getFlashcards = async (deckId: string): Promise<Flashcard[]> => {
  // 1. Leer localmente primero (SQLite + MMKV)
  const sqliteCards = await flashcardRepository.getByDeck(deckId);
  const mmkvCards = getLocalCardsFromMMKV(deckId);
  const localData = mergeCards(sqliteCards || [], mmkvCards);

  // 2. Sincronizar en background (solo crea registros nuevos, nunca sobreescribe)
  (async () => {
    try {
      const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) await flashcardRepository.upsertFromCloud(c);
        }
      }
    } catch {}
  })();

  return localData;
};

export const getFlashcardsPrioritized = async (deckId: string): Promise<Flashcard[]> => {
  // 1. Leer localmente primero (SQLite + MMKV)
  const sqliteCards = await flashcardRepository.getByDeck(deckId);
  const mmkvCards = getLocalCardsFromMMKV(deckId);
  const localData = mergeCards(sqliteCards || [], mmkvCards);

  // 2. Sincronizar en background (solo crea registros nuevos, nunca sobreescribe)
  (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards/prioritized?userId=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) await flashcardRepository.upsertFromCloud(c);
        }
      }
    } catch {}
  })();

  return localData;
};

function searchCardInMMKV(cardId: string): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkv = require('react-native-mmkv').createMMKV();
    const allKeys = mmkv.getAllKeys() as string[];
    const deckKeys = allKeys.filter((k: string) => k.startsWith('cache:flashcards_by_deck:'));
    for (const key of deckKeys) {
      const raw = mmkv.getString(key);
      if (raw) {
        const entry = JSON.parse(raw);
        const cards = entry.data || entry || [];
        const found = cards.find((c: any) => String(c.id) === cardId);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

export const getCardById = async (cardId: string): Promise<Flashcard | null> => {
  // 1. Leer localmente primero (SQLite)
  const localCard = await flashcardRepository.getById(cardId);
  if (localCard) {
    // 2. Sincronizar en background (solo crea registros nuevos, nunca sobreescribe)
    (async () => {
      try {
        const response = await fetchWithFallback(`/flashcards/${cardId}`);
        if (response.ok) {
          const data = await parseJsonSafely(response);
          if (data) await flashcardRepository.upsertFromCloud(data);
        }
      } catch {}
    })();
    return localCard;
  }

  // 3. Buscar en MMKV (tarjetas importadas localmente)
  const mmkvCard = searchCardInMMKV(cardId);
  if (mmkvCard) return mmkvCard;

  // 4. Intentar red si no está en local
  try {
    const response = await fetchWithFallback(`/flashcards/${cardId}`);
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await flashcardRepository.create(data);
      return data;
    }
    throw new Error(data?.error || 'Error al obtener tarjeta');
  } catch {
    return null;
  }
};

export const createFlashcard = async (payload: { deck_id: string; front: string; back: string; direction?: CardDirection; id?: string; ease_factor?: number; interval_days?: number; repetitions?: number; next_review_date?: string; fsrs_stability?: number; fsrs_difficulty?: number }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();

  await requireActiveFlashcardDeck(payload.deck_id);

  const card: any = { id, ...payload, status: 'new', created_at: new Date().toISOString() };

  await flashcardRepository.create(card);

  try {
    const { databaseService } = await import('../database/DatabaseService');
    await databaseService.getDb().runAsync('UPDATE flashcard_decks SET card_count = card_count + 1 WHERE id = ?', [payload.deck_id]);
  } catch (e) {
    console.warn('[Flashcards API] Error incrementing card_count:', e);
  }

  try {
    const response = await fetchWithFallback(`/flashcard-decks/${payload.deck_id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await flashcardRepository.update(data.id, data);
      return data;
    }
    throw new Error(data?.error || 'Error al crear tarjeta');
  } catch {
    await syncService.enqueueCreate('flashcard', id, { ...payload, id });
    return card;
  }
};

export const createEvaluationItem = async (payload: { deck_id: string; item_type: 'flashcard' | 'multiple_choice' | 'boolean'; content_json: any; direction?: CardDirection; hint?: string; explanation?: string; id?: string }): Promise<any> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = payload.id || uuidv4();

  await requireActiveFlashcardDeck(payload.deck_id);

  const item: any = { id, status: 'new', created_at: new Date().toISOString(), ...payload };

  await flashcardRepository.create(item);

  try {
    const { databaseService } = await import('../database/DatabaseService');
    await databaseService.getDb().runAsync('UPDATE flashcard_decks SET card_count = card_count + 1 WHERE id = ?', [payload.deck_id]);
  } catch (e) {
    console.warn('[Flashcards API] Error incrementing card_count:', e);
  }

  try {
    const response = await fetchWithFallback(`/flashcard-decks/${payload.deck_id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await flashcardRepository.update(data.id, data);
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

  // Try deleting from local MMKV if it's a local-only deck
  try {
    const { deleteLocalDeck } = await import('../localFlashcardService');
    deleteLocalDeck(deckId);
  } catch {}

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
  // 1. Leer localmente primero (SQLite + MMKV)
  const sqliteCards = await flashcardRepository.getByDeck(deckId);
  const mmkvCards = getLocalCardsFromMMKV(deckId);
  const localData = mergeCards(sqliteCards || [], mmkvCards);

  // 2. Sincronizar en background (solo crea registros nuevos, nunca sobreescribe)
  (async () => {
    try {
      const userId = await getUserId();
      const response = await fetchWithFallback(`/flashcard-decks/${deckId}/cards/not-snoozed?userId=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (Array.isArray(data)) {
          for (const c of data) await flashcardRepository.upsertFromCloud(c);
        }
      }
    } catch {}
  })();

  return localData;
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
  try {
    const card = await flashcardRepository.getById(cardId);
    if (card && card.deck_id) {
      const { databaseService } = await import('../database/DatabaseService');
      await databaseService.getDb().runAsync('UPDATE flashcard_decks SET card_count = MAX(0, card_count - 1) WHERE id = ?', [card.deck_id]);
    }
  } catch (e) {
    console.warn('[Flashcards API] Error decrementing card_count:', e);
  }

  await flashcardRepository.delete(cardId);

  try {
    const response = await fetchWithFallback(`/flashcards/${cardId}`, { method: 'DELETE' });
    return await parseJsonSafely(response);
  } catch {
    await syncService.enqueueDelete('flashcard', cardId);
    return { success: true, _isPending: true };
  }
};
