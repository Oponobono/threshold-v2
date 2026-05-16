import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getFlashcardDecksWithMetrics, type FlashcardDeck, type Subject } from '../services/api';

export interface FlashcardsManagerResult {
  decks: FlashcardDeck[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeSubjectId: number | null;
  setActiveSubjectId: (id: number | null) => void;
  subjects: Subject[];
  filteredDecks: FlashcardDeck[];
  loadDecks: () => Promise<void>;
}

/**
 * Hook para manejar la lógica de la pantalla de Mazos (Flashcards).
 * Gestiona búsqueda y filtrado por materia.
 */
export const useFlashcardsManager = (subjects: Subject[]): FlashcardsManagerResult => {
  const { t } = useTranslation();

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);

  const loadDecks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFlashcardDecksWithMetrics();
      setDecks(data || []);
    } catch (e) {
      console.warn('Error loading decks:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredDecks = useMemo(() => {
    let result = [...decks];

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((deck) => 
        deck.title.toLowerCase().includes(q) ||
        (deck.description || '').toLowerCase().includes(q)
      );
    }

    // Filter by subject
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
