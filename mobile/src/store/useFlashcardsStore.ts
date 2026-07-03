import { create } from 'zustand';
import { flashcardDeckRepository, calendarEventRepository, subjectRepository, flashcardRepository } from '../services/database';
import { getFlashcardDecksWithMetrics, type FlashcardDeck } from '../services/api';

export enum FlashcardsStoreState {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
}

interface FlashcardsStore {
  decks: FlashcardDeck[];
  status: FlashcardsStoreState;

  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  upsert: (deck: FlashcardDeck) => void;
  remove: (deckId: string) => void;
}

async function enrichWithLocalMetrics(decks: FlashcardDeck[]): Promise<FlashcardDeck[]> {
  try {
    const allEvents = await calendarEventRepository.getAll();
    const allSubjects = await subjectRepository.getAll();
    const allFlashcards = await flashcardRepository.getAll();
    
    const eventMap = new Map<string, { id: string; title: string; start_date: string }>();
    const deckToExam = new Map<string, { id: string; title: string; start_date: string }>();
    const subjectMap = new Map(allSubjects.map(s => [String(s.id), s]));
    const deckCardsMap = new Map<string, typeof allFlashcards>();

    for (const card of allFlashcards) {
      const did = String(card.deck_id);
      if (!deckCardsMap.has(did)) deckCardsMap.set(did, []);
      deckCardsMap.get(did)!.push(card);
    }

    for (const evt of allEvents) {
      const entry = { id: String(evt.id), title: evt.title, start_date: evt.start_date || evt.end_date || '' };
      eventMap.set(String(evt.id), entry);
      const linkedDeckId = (evt as any).linked_deck_id;
      if (linkedDeckId) {
        String(linkedDeckId).split(',').map((id: string) => id.trim()).filter(Boolean)
          .forEach((id: string) => deckToExam.set(id, entry));
      }
    }

    return decks.map(d => {
      let enrichedDeck = { ...d };

      // Attach subject metadata
      if (d.subject_id) {
        const subject = subjectMap.get(String(d.subject_id));
        if (subject) {
          enrichedDeck.subject_name = subject.name;
          enrichedDeck.subject_color = subject.color;
          enrichedDeck.subject_icon = subject.icon;
        }
      }

      // Attach local metrics
      const localCards = deckCardsMap.get(String(d.id)) || [];
      if (d.card_count == null) enrichedDeck.card_count = localCards.length;
      if (d.new_count == null) enrichedDeck.new_count = localCards.filter(c => !c.status || c.status === 'new').length;
      if (d.learning_count == null) enrichedDeck.learning_count = localCards.filter(c => c.status === 'learning').length;
      
      const now = new Date();
      if (d.review_count == null) {
        enrichedDeck.review_count = localCards.filter(c => 
          (c.status === 'review' || c.status === 'graduated') && 
          c.next_review_at && new Date(c.next_review_at) <= now
        ).length;
      }

      const linkedEventId = (d as any).linked_event_id;
      if (linkedEventId) {
        const rawId = String(linkedEventId).split(',')[0].trim();
        const evt = eventMap.get(rawId);
        if (evt) {
          enrichedDeck.linked_exam_title = evt.title;
          enrichedDeck.linked_exam_date = evt.start_date;
        }
      } else {
        const examFromEvent = deckToExam.get(String(d.id));
        if (examFromEvent) {
          flashcardDeckRepository.update(String(d.id), { linked_event_id: examFromEvent.id } as any).catch(() => {});
          enrichedDeck.linked_event_id = examFromEvent.id;
          enrichedDeck.linked_exam_title = examFromEvent.title;
          enrichedDeck.linked_exam_date = examFromEvent.start_date;
        }
      }
      return enrichedDeck;
    });
  } catch {
    return decks;
  }
}

let refreshInProgress: Promise<void> | null = null;

export const useFlashcardsStore = create<FlashcardsStore>((set, get) => ({
  decks: [],
  status: FlashcardsStoreState.NOT_INITIALIZED,

  initialize: async () => {
    if (get().status !== FlashcardsStoreState.NOT_INITIALIZED) return;

    set({ status: FlashcardsStoreState.INITIALIZING });
    const t0 = Date.now();

    try {
      const sqliteDecks = await flashcardDeckRepository.getAll();
      const enriched = await enrichWithLocalMetrics(sqliteDecks as unknown as FlashcardDeck[]);
      set({ decks: enriched, status: FlashcardsStoreState.READY });
      console.log(`[FlashcardsStore] ✅ initialize() READY — ${enriched.length} decks in ${Date.now() - t0}ms`);
    } catch (e) {
      console.warn('[FlashcardsStore] Error initializing from SQLite:', e);
      set({ status: FlashcardsStoreState.READY });
    }
  },

  refresh: async () => {
    if (refreshInProgress) return refreshInProgress;

    refreshInProgress = (async () => {
      try {
        const sqliteDecks = await flashcardDeckRepository.getAll();
        const enriched = await enrichWithLocalMetrics(sqliteDecks as unknown as FlashcardDeck[]);
        set({ decks: enriched });
      } catch (e) {
        console.warn('[FlashcardsStore] Error refreshing decks:', e);
      } finally {
        refreshInProgress = null;
      }
    })();

    return refreshInProgress;
  },

  upsert: (deck: FlashcardDeck) => {
    set((state) => {
      const index = state.decks.findIndex(d => d.id === deck.id);
      if (index >= 0) {
        const updated = [...state.decks];
        updated[index] = deck;
        return { decks: updated };
      }
      return { decks: [...state.decks, deck] };
    });
  },

  remove: (deckId: string) => {
    set((state) => ({ decks: state.decks.filter(d => d.id !== deckId) }));
  },
}));
