import { create } from 'zustand';
import { flashcardDeckRepository, calendarEventRepository, subjectRepository, flashcardRepository } from '../services/database';
import { getFlashcardDecksWithMetrics, type FlashcardDeck } from '../services/api';
import { repositoryEventBus } from '../services/events/RepositoryEventBus';
import { databaseService } from '../services/database/DatabaseService';

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
  subscribeToEvents: () => () => void;
}

async function enrichWithLocalMetrics(decks: FlashcardDeck[]): Promise<FlashcardDeck[]> {
  try {
    if (decks.length === 0) return decks;
    
    const allEvents = await calendarEventRepository.getAll();
    const allSubjects = await subjectRepository.getAll();
    
    const deckIds = decks.map(d => String(d.id));
    const placeholders = deckIds.map(() => '?').join(',');
    const db = databaseService.getDb();
    const relevantFlashcards = await db.getAllAsync(`SELECT deck_id, status, next_review_date FROM flashcards WHERE deck_id IN (${placeholders})`, deckIds);
    
    const eventMap = new Map<string, { id: string; title: string; start_date: string }>();
    const deckToExam = new Map<string, { id: string; title: string; start_date: string }>();
    const subjectMap = new Map(allSubjects.map(s => [String(s.id), s]));
    const deckCardsMap = new Map<string, any[]>();

    for (const card of relevantFlashcards as any[]) {
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

      if (d.subject_id) {
        const subject = subjectMap.get(String(d.subject_id));
        if (subject) {
          enrichedDeck.subject_name = subject.name;
          enrichedDeck.subject_color = subject.color;
          enrichedDeck.subject_icon = subject.icon;
        }
      }

      const localCards = deckCardsMap.get(String(d.id)) || [];
      if (d.card_count == null) enrichedDeck.card_count = localCards.length;
      if (d.new_count == null) enrichedDeck.new_count = localCards.filter(c => !c.status || c.status === 'new').length;
      if (d.learning_count == null) enrichedDeck.learning_count = localCards.filter(c => c.status === 'learning').length;
      
      const now = new Date();
      if (d.review_count == null) {
        enrichedDeck.review_count = localCards.filter(c => 
          (c.status === 'review' || c.status === 'graduated') && 
          c.next_review_date && new Date(c.next_review_date) <= now
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

  subscribeToEvents: () => {
    // When a deck is mutated
    const unsubDeck = repositoryEventBus.onBatch('flashcard_decks', async (event) => {
      if (get().status !== FlashcardsStoreState.READY) return;
      try {
        const affectedDeckIds = [...new Set(event.entities.map(e => String(e.id)))];
        if (affectedDeckIds.length === 0) return;
        
        // Fetch only affected decks
        const placeholders = affectedDeckIds.map(() => '?').join(',');
        const db = databaseService.getDb();
        const rows = await db.getAllAsync(`SELECT * FROM flashcard_decks WHERE id IN (${placeholders})`, affectedDeckIds);
        
        if (rows.length > 0) {
          const enriched = await enrichWithLocalMetrics(rows as unknown as FlashcardDeck[]);
          const { upsert } = get();
          enriched.forEach(d => upsert(d));
        }
      } catch (e) {
        console.warn('[FlashcardsStore] Incremental deck update failed', e);
      }
    });

    // When a flashcard is mutated
    const unsubFlashcard = repositoryEventBus.onBatch('flashcards', async (event) => {
      if (get().status !== FlashcardsStoreState.READY) return;
      try {
        // We need to find which decks were affected by these cards
        const cardIds = [...new Set(event.entities.map(e => String(e.id)))];
        if (cardIds.length === 0) return;
        
        const placeholders = cardIds.map(() => '?').join(',');
        const db = databaseService.getDb();
        
        // Get unique deck_ids for these cards
        const rows = await db.getAllAsync(`SELECT DISTINCT deck_id FROM flashcards WHERE id IN (${placeholders})`, cardIds);
        const affectedDeckIds = rows.map((r: any) => String(r.deck_id));
        
        if (affectedDeckIds.length > 0) {
          const deckPlaceholders = affectedDeckIds.map(() => '?').join(',');
          const deckRows = await db.getAllAsync(`SELECT * FROM flashcard_decks WHERE id IN (${deckPlaceholders})`, affectedDeckIds);
          
          if (deckRows.length > 0) {
            const enriched = await enrichWithLocalMetrics(deckRows as unknown as FlashcardDeck[]);
            const { upsert } = get();
            enriched.forEach(d => upsert(d));
          }
        }
      } catch (e) {
        console.warn('[FlashcardsStore] Incremental flashcard update failed', e);
      }
    });

    return () => {
      unsubFlashcard();
      unsubDeck();
    };
  },
}));
