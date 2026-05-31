import { cacheService, saveToCacheSync, loadFromCacheSync, CACHE_KEYS } from './cacheService';

let _localIdCounter = -1;

function nextLocalId(): number {
  return _localIdCounter--;
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

export function getLocalDecks(): LocalDeck[] {
  return loadFromCacheSync<LocalDeck[]>(LOCAL_DECKS_KEY, Infinity) || [];
}

function saveLocalDecks(decks: LocalDeck[]): void {
  saveToCacheSync(LOCAL_DECKS_KEY, decks);
}

export function saveImportedDeck(
  title: string,
  description: string | undefined,
  cards: LocalCard[],
  subject_id: number | null,
): LocalDeck {
  const deck: LocalDeck = {
    id: nextLocalId(),
    title: title.trim(),
    description: description?.trim() || '',
    subject_id,
    card_count: cards.length,
    user_id: 0,
    created_at: new Date().toISOString(),
    review_count: 0,
    learning_count: 0,
    new_count: cards.length,
    _local: true,
  };

  const existing = getLocalDecks();
  saveLocalDecks([...existing, deck]);

  const items = cards.map((card, i) => ({
    id: nextLocalId(),
    deck_id: deck.id,
    item_type: card.type || 'flashcard',
    content: card.data,
    hint: card.hint || null,
    explanation: card.explanation || null,
    status: 'new' as const,
    created_at: new Date().toISOString(),
    front: card.data?.front || '',
    back: card.data?.back || '',
  }));

  saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_BY_DECK}${deck.id}`, items);
  saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deck.id}`, items);
  saveToCacheSync(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deck.id}`, items);

  mergeIntoDecksCache(deck);

  return deck;
}

export function updateLocalDeckSubject(deckId: number, subjectId: number): void {
  const decks = getLocalDecks();
  const idx = decks.findIndex(d => d.id === deckId);
  if (idx === -1) return;
  decks[idx] = { ...decks[idx], subject_id: subjectId };
  saveLocalDecks(decks);
  mergeIntoDecksCache(decks[idx]);
}

export function deleteLocalDeck(deckId: number): void {
  const decks = getLocalDecks().filter(d => d.id !== deckId);
  saveLocalDecks(decks);
  saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`, null);
  saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, null);
  saveToCacheSync(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, null);
  refreshDecksCacheFromLocal();
}

function mergeIntoDecksCache(deck: LocalDeck): void {
  const metricsDecks = loadFromCacheSync<any[]>(`${CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS}`, Infinity) || [];
  const idx = metricsDecks.findIndex((d: any) => d.id === deck.id);
  if (idx >= 0) {
    metricsDecks[idx] = { ...metricsDecks[idx], ...deck };
  } else {
    metricsDecks.push(deck);
  }
  saveToCacheSync(CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS, metricsDecks);

  const simpleDecks = loadFromCacheSync<any[]>(CACHE_KEYS.FLASHCARD_DECKS, Infinity) || [];
  const idx2 = simpleDecks.findIndex((d: any) => d.id === deck.id);
  if (idx2 >= 0) {
    simpleDecks[idx2] = { ...simpleDecks[idx2], ...deck };
  } else {
    simpleDecks.push(deck);
  }
  saveToCacheSync(CACHE_KEYS.FLASHCARD_DECKS, simpleDecks);
}

function refreshDecksCacheFromLocal(): void {
  const localDecks = getLocalDecks();
  if (localDecks.length === 0) return;

  const metricsDecks = loadFromCacheSync<any[]>(`${CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS}`, Infinity) || [];
  const filtered = metricsDecks.filter((d: any) => !d._local || localDecks.some(ld => ld.id === d.id));
  for (const ld of localDecks) {
    if (!filtered.some((d: any) => d.id === ld.id)) {
      filtered.push(ld);
    }
  }
  saveToCacheSync(CACHE_KEYS.FLASHCARD_DECKS_WITH_METRICS, filtered);

  const simpleDecks = loadFromCacheSync<any[]>(CACHE_KEYS.FLASHCARD_DECKS, Infinity) || [];
  const filtered2 = simpleDecks.filter((d: any) => !d._local || localDecks.some(ld => ld.id === d.id));
  for (const ld of localDecks) {
    if (!filtered2.some((d: any) => d.id === ld.id)) {
      filtered2.push(ld);
    }
  }
  saveToCacheSync(CACHE_KEYS.FLASHCARD_DECKS, filtered2);
}
