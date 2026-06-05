import { useState, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getFlashcardDecksWithMetrics, type FlashcardDeck, type Subject } from '../services/api';
import { flashcardDeckRepository } from '../services/database';

export interface FlashcardsManagerResult {
  decks: FlashcardDeck[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeSubjectId: string | null;
  setActiveSubjectId: (id: string | null) => void;
  subjects: Subject[];
  filteredDecks: FlashcardDeck[];
  loadDecks: () => Promise<void>;
}

/**
 * Hook para manejar la lógica de la pantalla de Mazos (Flashcards).
 * Gestiona búsqueda y filtrado por materia.
 *
 * FIXES:
 * - Usa un contador de generación para cancelar respuestas obsoletas
 *   (race condition donde múltiples loadDecks() se sobreescriben entre sí)
 * - No reinicia decks a [] en errores (preserva el estado existente)
 */
export const useFlashcardsManager = (subjects: Subject[]): FlashcardsManagerResult => {
  const { t } = useTranslation();

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

  /**
   * Contador de generación: cada vez que se inicia una carga, se incrementa.
   * Si cuando llega la respuesta el contador ya cambió, la respuesta es obsoleta
   * y se descarta. Esto evita el race condition de múltiples cargas concurrentes.
   */
  const loadGenRef = useRef(0);

  const loadDecks = useCallback(async () => {
    const generation = ++loadGenRef.current;
    setIsLoading(true);

    // Fase 1: Cache-first — mostrar datos instantáneos desde SQLite
    const cached = await flashcardDeckRepository.getAll();
    if (cached.length > 0 && generation === loadGenRef.current) {
      setDecks(cached as any);
      setIsLoading(false);
    }

    // Fase 2: Refresh desde la red
    try {
      const data = await getFlashcardDecksWithMetrics();
      if (generation === loadGenRef.current) {
        setDecks(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn('[useFlashcardsManager] Error cargando mazos:', e);
      if (generation === loadGenRef.current && decks.length === 0) {
        setDecks([]);
      }
    } finally {
      if (generation === loadGenRef.current) {
        setIsLoading(false);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDecks = useMemo(() => {
    const safeDecks = Array.isArray(decks) ? decks : [];
    let result = [...safeDecks];

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
