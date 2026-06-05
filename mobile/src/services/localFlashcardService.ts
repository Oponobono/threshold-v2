import { getUserId } from './api';
import { syncService } from './database';
import { storageService } from './storageService';

let _localIdCounter = -Date.now();

function nextLocalId(): number {
  _localIdCounter -= 1;
  return _localIdCounter;
}

export interface LocalCard {
  type: 'flashcard' | 'multiple_choice' | 'boolean';
  data: any;
  hint?: string;
  explanation?: string;
}

export interface LocalDeck {
  id: number;
  title: string;
  description: string;
  subject_id: number | null;
  card_count: number;
  user_id: number;
  created_at: string;
  review_count: number;
  learning_count: number;
  new_count: number;
  _local: boolean;
}

const LOCAL_DECKS_KEY = 'local:flashcard_decks';

function getLocalDecksSync(): LocalDeck[] {
  try {
    const raw = require('react-native-mmkv').createMMKV().getString(LOCAL_DECKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDecksSync(decks: LocalDeck[]): void {
  try {
    require('react-native-mmkv').createMMKV().set(LOCAL_DECKS_KEY, JSON.stringify(decks));
  } catch (e) {
    console.warn('[LocalFlashcard] Error saving local decks:', e);
  }
}

export function getLocalDecks(): LocalDeck[] {
  return getLocalDecksSync();
}

export async function saveImportedDeck(
  title: string,
  description: string | undefined,
  cards: LocalCard[],
  subject_id: number | null,
): Promise<LocalDeck> {
  const deck: LocalDeck = {
    id: nextLocalId(),
    title: title.trim(),
    description: description?.trim() || '',
    subject_id,
    card_count: cards.length,
    user_id: Number(await getUserId()) || 0,
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

export function updateLocalDeckSubject(deckId: number, subjectId: number): void {
  const decks = getLocalDecks();
  const idx = decks.findIndex(d => d.id === deckId);
  if (idx === -1) return;
  decks[idx] = { ...decks[idx], subject_id: subjectId };
  saveLocalDecksSync(decks);
}

export function deleteLocalDeck(deckId: string): void {
  const decks = getLocalDecks().filter(d => String(d.id) !== deckId);
  saveLocalDecksSync(decks);
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
export async function prepareDeckForSync(deckId: number, userId: number): Promise<void> {
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

export function updateLocalCard(deckId: number, cardId: number, updates: Partial<LocalCard>): void {
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

    const idx = cards.findIndex(c => c.id === cardId);
    if (idx === -1) {
      throw new Error(`Tarjeta ${cardId} no encontrada`);
    }

    cards[idx] = {
      ...cards[idx],
      ...(updates.data && { content: updates.data, ...(updates.data?.front && { front: updates.data.front }), ...(updates.data?.back && { back: updates.data.back }) }),
      ...(updates.hint !== undefined && { hint: updates.hint }),
      ...(updates.explanation !== undefined && { explanation: updates.explanation }),
    };

    mmkv.set(cardsKey, JSON.stringify({ data: cards, timestamp: Date.now() }));
  } catch (error) {
    console.error('[LocalFlashcard] Error updating card:', error);
    throw error;
  }
}