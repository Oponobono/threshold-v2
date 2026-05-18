import { useState, useMemo, useCallback, useRef } from 'react';
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
 *
 * FIXES:
 * - Usa un contador de generación para cancelar respuestas obsoletas
 *   (race condition donde múltiples loadDecks() se sobreescriben entre sí)
 * - No reinicia decks a [] en errores (preserva el estado existente)
 */
export const useFlashcardsManager = (subjects: Subject[]): FlashcardsManagerResult => {
  const { t } = useTranslation();

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);

  /**
   * Contador de generación: cada vez que se inicia una carga, se incrementa.
   * Si cuando llega la respuesta el contador ya cambió, la respuesta es obsoleta
   * y se descarta. Esto evita el race condition de múltiples cargas concurrentes.
   */
  const loadGenRef = useRef(0);

  const loadDecks = useCallback(async () => {
    const generation = ++loadGenRef.current;
    setIsLoading(true);
    try {
      const data = await getFlashcardDecksWithMetrics();
      // Solo actualizar si esta sigue siendo la carga más reciente
      if (generation === loadGenRef.current) {
        setDecks(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn('[useFlashcardsManager] Error cargando mazos:', e);
      // NO reiniciar a [] — preservar la lista actual para no perder mazos
      // por errores de red transitorios o condiciones de carrera
      if (generation === loadGenRef.current && decks.length === 0) {
        // Solo resetear si realmente no había nada antes (primera carga fallida)
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
