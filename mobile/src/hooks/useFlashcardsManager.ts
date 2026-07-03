import { useState, useMemo, useCallback } from 'react';
import { type FlashcardDeck, type Subject } from '../services/api';
import { useFlashcardsStore, FlashcardsStoreState } from '../store/useFlashcardsStore';

export interface FlashcardsManagerResult {
  decks: FlashcardDeck[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeSubjectId: string | null;
  setActiveSubjectId: (id: string | null) => void;
  subjects: Subject[];
  filteredDecks: FlashcardDeck[];
  loadDecks: (options?: { skipCache?: boolean; cooldownMs?: number }) => Promise<void>;
}

export const useFlashcardsManager = (subjects: Subject[]): FlashcardsManagerResult => {
  const { decks, status, initialize, refresh } = useFlashcardsStore();
  const isLoading = status !== FlashcardsStoreState.READY;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  const loadDecks = useCallback(async (options?: { skipCache?: boolean; cooldownMs?: number }) => {
    if (status === FlashcardsStoreState.NOT_INITIALIZED) {
      await initialize();
    }
    if (options?.skipCache) {
      await refresh();
    }
  }, [status, initialize, refresh]);

  const filteredDecks = useMemo(() => {
    const safeDecks = Array.isArray(decks) ? decks : [];
    let result = [...safeDecks];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((deck) =>
        deck.title.toLowerCase().includes(q) ||
        (deck.description || '').toLowerCase().includes(q)
      );
    }

    if (activeSubjectId !== null) {
      result = result.filter((deck) => deck.subject_id === activeSubjectId);
    }

    return result;
  }, [decks, searchQuery, activeSubjectId]);

  return {
    decks,
    isLoading,
    searchQuery,
    setSearchQuery,
    activeSubjectId,
    setActiveSubjectId,
    subjects,
    filteredDecks,
    loadDecks,
  };
};
