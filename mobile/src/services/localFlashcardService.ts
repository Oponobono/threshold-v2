import { getUserId } from './api/auth';
import { syncService } from './database';

let _localIdCounter = -Date.now();

function nextLocalId(): number {
  _localIdCounter -= 1;
  return _localIdCounter;
}

export type LocalCardDirection = 'forward' | 'backward' | 'bidirectional';

export interface LocalCard {
  type: 'flashcard' | 'multiple_choice' | 'boolean';
  data: any;
  hint?: string;
  explanation?: string;
  direction?: LocalCardDirection;
}

export interface LocalDeck {
  id: number;
  title: string;
  description: string;
  subject_id: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  subject_icon?: string | null;
  card_count: number;
  user_id: string | number;
  created_at: string;
  review_count: number;
  learning_count: number;
  new_count: number;
  _local: boolean;
  linked_event_id?: string;
}

const LOCAL_DECKS_KEY = 'local:flashcard_decks';

function getLocalDecksSync(): LocalDeck[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('react-native-mmkv').createMMKV().getString(LOCAL_DECKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Guard: handle { data: [...] } wrapper written accidentally, or any non-array
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    console.warn('[LocalFlashcard] getLocalDecksSync: unexpected shape, resetting:', typeof parsed);
    return [];
  } catch {
    return [];
  }
}

function saveLocalDecksSync(decks: LocalDeck[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-mmkv').createMMKV().set(LOCAL_DECKS_KEY, JSON.stringify(decks));
  } catch (e) {
    console.warn('[LocalFlashcard] Error saving local decks:', e);
  }
}

export function getLocalDecks(): LocalDeck[] {
  return getLocalDecksSync();
}

/**
 * Versión filtrada por userId activo: Único punto de acceso público.
 * Garantiza que aunque el MMKV tenga datos residuales de otra sesión,
 * solo se devuelven los mazos del usuario autenticado actualmente.
 * La limpieza definitiva ocurre en signOut → clearAllUserData.
 */
export function getLocalDecksForCurrentUser(currentUserId?: string | null): LocalDeck[] {
  const all = getLocalDecksSync();
  // Extra safety: getLocalDecksSync always returns [], but guard just in case
  if (!Array.isArray(all)) return [];
  if (!currentUserId) return all; // sin userId no podemos filtrar (fallback seguro)

  return all.filter(d => {
    // Soportar tanto UUIDs (strings) como IDs numéricos legacy
    return String(d.user_id) === String(currentUserId);
  });
}

export async function saveImportedDeck(
  title: string,
  description: string | undefined,
  cards: LocalCard[],
  subject_id: string | null,
  subject_name?: string | null,
  subject_color?: string | null,
  subject_icon?: string | null,
): Promise<LocalDeck> {
  const uid = await getUserId();
  const deck: LocalDeck = {
    id: nextLocalId(),
    title: title.trim(),
    description: description?.trim() || '',
    subject_id,
    subject_name,
    subject_color,
    subject_icon,
    card_count: cards.length,
    user_id: uid || 0,
    created_at: new Date().toISOString(),
    review_count: 0,
    learning_count: 0,
    new_count: cards.length,
    _local: true,
  };

  const existing = getLocalDecks();
  saveLocalDecksSync([...existing, deck]);

  return deck;
}

export function updateLocalDeckSubject(
  deckId: number,
  subjectId: string | null,
  subjectName?: string | null,
  subjectColor?: string | null,
  subjectIcon?: string | null,
): void {
  const decks = getLocalDecks();
  const idx = decks.findIndex(d => d.id === deckId);
  if (idx === -1) return;
  decks[idx] = {
    ...decks[idx],
    subject_id: subjectId,
    ...(subjectName !== undefined ? { subject_name: subjectName } : {}),
    ...(subjectColor !== undefined ? { subject_color: subjectColor } : {}),
    ...(subjectIcon !== undefined ? { subject_icon: subjectIcon } : {}),
  };
  saveLocalDecksSync(decks);
}

export function deleteLocalDeck(deckId: string): void {
  const decks = getLocalDecks().filter(d => String(d.id) !== String(deckId));
  saveLocalDecksSync(decks);
}

export function recalculateLocalDeckCounters(deckId: number): void {
  try {
    const mmkv = require('react-native-mmkv').createMMKV();
    const cardsKey = `cache:flashcards_by_deck:${deckId}`;
    const raw = mmkv.getString(cardsKey);
    if (!raw) return;

    const entry = JSON.parse(raw);
    const cards: any[] = entry.data || entry || [];
    let reviewCount = 0;
    let learningCount = 0;
    let newCount = 0;

    for (const card of cards) {
      const status = card.status || 'new';
      if (status === 'review') reviewCount++;
      else if (status === 'learning') learningCount++;
      else newCount++;
    }

    const decks = getLocalDecks();
    const idx = decks.findIndex(d => d.id === deckId);
    if (idx === -1) return;

    decks[idx] = {
      ...decks[idx],
      card_count: cards.length,
      review_count: reviewCount,
      learning_count: learningCount,
      new_count: newCount,
    };
    saveLocalDecksSync(decks);
  } catch (e) {
    console.error('[LocalFlashcard] Error recalculating deck counters:', e);
  }
}

/**
 * OFFLINE-FIRST: Exporta un mazo local a JSON sin exponer user_id (seguridad)
 */
export async function exportDeckToJSON(deckId: number): Promise<any> {
  try {
    const allDecks = getLocalDecks();
    const deck = allDecks.find(d => d.id === deckId);

    if (!deck) {
      throw new Error(`Mazo ${deckId} no encontrado`);
    }

    const cardsKey = `cache:flashcards_by_deck:${deckId}`;
    let cards: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const raw = require('react-native-mmkv').createMMKV().getString(cardsKey);
      if (raw) {
        const entry = JSON.parse(raw);
        cards = entry.data || entry || [];
      }
    } catch {}

    const exportData = {
      title: deck.title,
      description: deck.description || '',
      cards: cards.map(card => {
        const cardExport: any = {
          type: card.item_type || 'flashcard',
        };

        if (card.content) {
          cardExport.data = card.content;
        } else if (card.item_type === 'flashcard') {
          cardExport.data = {
            front: card.front || '',
            back: card.back || '',
          };
        }

        if (card.hint) cardExport.hint = card.hint;
        if (card.explanation) cardExport.explanation = card.explanation;
        if (card.direction && card.direction !== 'forward') cardExport.direction = card.direction;

        return cardExport;
      }),
    };

    return exportData;
  } catch (error) {
    console.error('[LocalFlashcard] Error exporting deck:', error);
    throw error;
  }
}

/**
 * OFFLINE-FIRST: Prepara sincronización de mazos importados
 */
export async function prepareDeckForSync(deckId: number, userId: string | number): Promise<void> {
  try {
    const decks = getLocalDecks();
    const idx = decks.findIndex(d => d.id === deckId);

    if (idx === -1) {
      throw new Error(`Mazo ${deckId} no encontrado`);
    }

    const deck = decks[idx];

    if (deck.user_id !== userId) {
      decks[idx] = { ...deck, user_id: userId };
      saveLocalDecksSync(decks);
    }

    const cardsKey = `cache:flashcards_by_deck:${deckId}`;
    let cards: any[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const raw = require('react-native-mmkv').createMMKV().getString(cardsKey);
      if (raw) {
        const entry = JSON.parse(raw);
        cards = entry.data || entry || [];
      }
    } catch {}

    const deckPayload = {
      id: deckId,
      title: deck.title,
      description: deck.description,
      subject_id: deck.subject_id,
      cards: cards.map(c => ({
        id: c.id,
        front: c.front || c.content?.front || '',
        back: c.back || c.content?.back || '',
        item_type: c.item_type || 'flashcard',
        content_json: c.content || c.data,
        hint: c.hint,
        explanation: c.explanation,
      })),
    };

    await syncService.enqueueCreate('flashcard-deck', String(deckId), deckPayload);
  } catch (error) {
    console.error('[LocalFlashcard] Error preparing deck for sync:', error);
    throw error;
  }
}

export function getPendingDecksForSync(): LocalDeck[] {
  try {
    const localDecks = getLocalDecks();
    return localDecks.filter(d => d._local === true && d.id < 0);
  } catch (error) {
    console.error('[LocalFlashcard] Error getting pending decks:', error);
    return [];
  }
}

export function updateLocalDeck(deckId: number, updates: Partial<LocalDeck>): void {
  try {
    const decks = getLocalDecks();
    const idx = decks.findIndex(d => d.id === deckId);

    if (idx === -1) {
      throw new Error(`Mazo ${deckId} no encontrado`);
    }

    decks[idx] = { ...decks[idx], ...updates };
    saveLocalDecksSync(decks);
  } catch (error) {
    console.error('[LocalFlashcard] Error updating deck:', error);
    throw error;
  }
}

export function addLocalCard(deckId: number, card: Omit<LocalCard, 'id'>): void {
  try {
    const mmkv = require('react-native-mmkv').createMMKV();
    const cardsKey = `cache:flashcards_by_deck:${deckId}`;

    let cards: any[] = [];
    try {
      const raw = mmkv.getString(cardsKey);
      if (raw) {
        const entry = JSON.parse(raw);
        cards = entry.data || entry || [];
      }
    } catch {}

    const newCard = {
      id: nextLocalId(),
      deck_id: deckId,
      item_type: card.type || 'flashcard',
      content: card.data,
      hint: card.hint || null,
      explanation: card.explanation || null,
      status: 'new' as const,
      created_at: new Date().toISOString(),
      front: card.data?.front || '',
      back: card.data?.back || '',
      direction: card.type === 'flashcard' ? (card.direction || 'forward') : undefined,
      _local: true,
      _isPending: true,
    };

    cards.push(newCard);
    mmkv.set(cardsKey, JSON.stringify({ data: cards, timestamp: Date.now() }));
  } catch (error) {
    console.error('[LocalFlashcard] Error adding card:', error);
    throw error;
  }
}

export function deleteLocalCard(deckId: number, cardId: number): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkv = require('react-native-mmkv').createMMKV();
    const cardsKey = `cache:flashcards_by_deck:${deckId}`;

    let cards: any[] = [];
    try {
      const raw = mmkv.getString(cardsKey);
      if (raw) {
        const entry = JSON.parse(raw);
        cards = entry.data || entry || [];
      }
    } catch {}

    cards = cards.filter(c => c.id !== cardId);
    mmkv.set(cardsKey, JSON.stringify({ data: cards, timestamp: Date.now() }));
  } catch (error) {
    console.error('[LocalFlashcard] Error deleting card:', error);
    throw error;
  }
}

export function updateLocalCard(
  deckId: number,
  cardId: number,
  updates: Partial<LocalCard>,
  status?: string,
  fsrs_stability?: number,
  fsrs_difficulty?: number,
  fsrs_repetitions?: number,
  next_review_date?: string,
): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mmkv = require('react-native-mmkv').createMMKV();
    const cardsKey = `cache:flashcards_by_deck:${deckId}`;

    let cards: any[] = [];
    try {
      const raw = mmkv.getString(cardsKey);
      if (raw) {
        const entry = JSON.parse(raw);
        cards = entry.data || entry || [];
      }
    } catch {}

    const idx = cards.findIndex(c => c.id === cardId);
    if (idx === -1) {
      throw new Error(`Tarjeta ${cardId} no encontrada`);
    }

    const fsrsUpdates: Record<string, any> = {};
    if (status !== undefined) fsrsUpdates.status = status;
    if (fsrs_stability !== undefined) fsrsUpdates.fsrs_stability = fsrs_stability;
    if (fsrs_difficulty !== undefined) fsrsUpdates.fsrs_difficulty = fsrs_difficulty;
    if (fsrs_repetitions !== undefined) fsrsUpdates.fsrs_repetitions = fsrs_repetitions;
    if (next_review_date !== undefined) fsrsUpdates.next_review_date = next_review_date;

    cards[idx] = {
      ...cards[idx],
      ...(updates.data && { content: updates.data, ...(updates.data?.front && { front: updates.data.front }), ...(updates.data?.back && { back: updates.data.back }) }),
      ...(updates.hint !== undefined && { hint: updates.hint }),
      ...(updates.explanation !== undefined && { explanation: updates.explanation }),
      ...fsrsUpdates,
    };

    mmkv.set(cardsKey, JSON.stringify({ data: cards, timestamp: Date.now() }));
  } catch (error) {
    console.error('[LocalFlashcard] Error updating card:', error);
    throw error;
  }
}

export function queuePendingReview(review: { cardId: number; grade: number; status: string; stability: number; difficulty: number }): void {
  const key = 'local_pending_reviews';
  const mmkv = require('react-native-mmkv').createMMKV();
  const existing = mmkv.getString(key);
  const reviews = existing ? JSON.parse(existing) : [];
  reviews.push(review);
  mmkv.set(key, JSON.stringify(reviews));
}

export function getPendingReviews(): Array<{ cardId: number; grade: number; status: string; stability: number; difficulty: number }> {
  const key = 'local_pending_reviews';
  const mmkv = require('react-native-mmkv').createMMKV();
  const existing = mmkv.getString(key);
  return existing ? JSON.parse(existing) : [];
}

export function clearPendingReviews(): void {
  const key = 'local_pending_reviews';
  const mmkv = require('react-native-mmkv').createMMKV();
  mmkv.delete(key);
}