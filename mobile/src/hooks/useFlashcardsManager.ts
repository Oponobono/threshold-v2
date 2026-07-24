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
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
  subjects: Subject[];
  filteredDecks: FlashcardDeck[];
  loadDecks: (options?: { skipCache?: boolean; cooldownMs?: number }) => Promise<void>;
  availableCourseIds: Set<string>;
  availableSubjectIds: Set<string>;
}

export const useFlashcardsManager = (subjects: Subject[]): FlashcardsManagerResult => {
  const { decks, status, initialize, refresh } = useFlashcardsStore();
  const isLoading = status !== FlashcardsStoreState.READY;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

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

    if (selectedCourseId !== null) {
      const subjectIdsInCourse = new Set(
        subjects.filter((s) => (s as any).course_id === selectedCourseId).map((s) => s.id)
      );
      result = result.filter((deck) => deck.subject_id != null && subjectIdsInCourse.has(deck.subject_id));
    }

    if (activeSubjectId !== null) {
      result = result.filter((deck) => deck.subject_id === activeSubjectId);
    }

    return result;
  }, [decks, searchQuery, activeSubjectId, selectedCourseId, subjects]);

  const { availableCourseIds, availableSubjectIds } = useMemo(() => {
    const safeDecks = Array.isArray(decks) ? decks : [];
    const subjectIds = new Set<string>();
    const courseIds = new Set<string>();
    safeDecks.forEach((deck) => {
      if (deck.subject_id) {
        subjectIds.add(deck.subject_id);
        const subj = subjects.find((s) => s.id === deck.subject_id);
        if (subj && (subj as any).course_id) {
          courseIds.add((subj as any).course_id);
        }
      }
    });
    return { availableCourseIds: courseIds, availableSubjectIds: subjectIds };
  }, [decks, subjects]);

  return {
    decks,
    isLoading,
    searchQuery,
    setSearchQuery,
    activeSubjectId,
    setActiveSubjectId,
    selectedCourseId,
    setSelectedCourseId,
    subjects,
    filteredDecks,
    loadDecks,
    availableCourseIds,
    availableSubjectIds,
  };
};
