import { useState, useMemo, useCallback, useRef } from 'react';
import { getFlashcardDecksWithMetrics, type FlashcardDeck, type Subject } from '../services/api';
import { flashcardDeckRepository, calendarEventRepository } from '../services/database';
import { getLocalDecksForCurrentUser, type LocalDeck } from '../services/localFlashcardService';
import { getUserId } from '../services/api/auth';

const LOAD_COOLDOWN_MS = 30_000;

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

async function enrichDecksWithExamInfo(decks: FlashcardDeck[]): Promise<FlashcardDeck[]> {
  try {
    const allEvents = await calendarEventRepository.getAll();
    // Mapa de eventId → metadata del evento
    const eventMap = new Map<string, { title: string; start_date: string }>();
    for (const evt of allEvents) {
      eventMap.set(String(evt.id), { title: evt.title, start_date: evt.start_date || evt.end_date || '' });
    }
    // Enriquecer cada mazo usando su propio linked_event_id
    return decks.map(d => {
      const linkedEventId = (d as any).linked_event_id;
      if (linkedEventId) {
        const evt = eventMap.get(String(linkedEventId));
        if (evt) {
          return { ...d, linked_exam_title: evt.title, linked_exam_date: evt.start_date };
        }
      }
      return d;
    });
  } catch {
    return decks;
  }
}

function localDeckToFlashcardDeck(local: LocalDeck, subjects: Subject[] = []): FlashcardDeck {
  const subject = local.subject_id ? subjects.find(s => s.id === local.subject_id) : undefined;
  return {
    id: String(local.id),
    user_id: String(local.user_id),
    subject_id: local.subject_id != null ? String(local.subject_id) : undefined,
    subject_name: local.subject_name ?? subject?.name ?? null,
    subject_color: local.subject_color ?? subject?.color ?? null,
    subject_icon: local.subject_icon ?? subject?.icon ?? null,
    title: local.title,
    description: local.description,
    card_count: local.card_count,
    review_count: local.review_count,
    learning_count: local.learning_count,
    new_count: local.new_count,
    created_at: local.created_at,
    _local: true,
  } as FlashcardDeck;
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
  const lastLoadedAtRef = useRef<number>(0);
  const pendingLoadRef = useRef<Promise<void> | null>(null);

  function mergeLocalDecks(remoteDecks: FlashcardDeck[], userId?: string | null): FlashcardDeck[] {
    const localDecks = getLocalDecksForCurrentUser(userId).map(d => localDeckToFlashcardDeck(d, subjects));
    const localIds = new Set(localDecks.map(d => d.id));
    // Filtrar remotos que están en locales (reemplazar) y también remotos con ID
    // negativo que ya no existen en MMKV (eliminados localmente pero aún en servidor)
    const remoteWithoutLocal = remoteDecks.filter(d => {
      if (localIds.has(d.id)) return false;
      const isNegativeId = !isNaN(Number(d.id)) && Number(d.id) < 0;
      if (isNegativeId) return false;
      return true;
    });
    return [...remoteWithoutLocal, ...localDecks];
  }

  const loadDecks = useCallback(async (options?: { skipCache?: boolean; cooldownMs?: number }) => {
    const cooldown = options?.cooldownMs ?? LOAD_COOLDOWN_MS;
    const now = Date.now();

    // Saltar si los datos aún son frescos (a menos que skipCache sea true)
    if (!options?.skipCache && lastLoadedAtRef.current > 0 && (now - lastLoadedAtRef.current) < cooldown) {
      return;
    }

    // Reusar carga en progreso si ya hay una
    if (pendingLoadRef.current) {
      return pendingLoadRef.current;
    }

    const generation = ++loadGenRef.current;

    const doLoad = async () => {
      const currentUserId = await getUserId();

      // Fase 1: Cache-first — mostrar datos instantáneos desde SQLite + locales
      const cached = await flashcardDeckRepository.getAll();
      const cachedWithLocal = mergeLocalDecks(cached as any, currentUserId);

      // Solo mostrar loading si realmente no hay datos previos
      if (cachedWithLocal.length > 0 && generation === loadGenRef.current) {
        const enriched = await enrichDecksWithExamInfo(cachedWithLocal);
        if (generation === loadGenRef.current) {
          setDecks(enriched);
          setIsLoading(false);
        }
      } else if (generation === loadGenRef.current) {
        setIsLoading(true);
      }

      // Fase 2: Refresh desde la red
      try {
        const data = await getFlashcardDecksWithMetrics();
        if (generation === loadGenRef.current) {
          const merged = mergeLocalDecks(Array.isArray(data) ? data : [], currentUserId);
          const enriched = await enrichDecksWithExamInfo(merged);
          if (generation === loadGenRef.current) {
            setDecks(enriched);
            lastLoadedAtRef.current = Date.now();
          }
        }
      } catch (e) {
        console.warn('[useFlashcardsManager] Error cargando mazos:', e);
        if (generation === loadGenRef.current && cachedWithLocal.length === 0) {
          const merged = mergeLocalDecks([], currentUserId);
          const enriched = await enrichDecksWithExamInfo(merged);
          if (generation === loadGenRef.current) {
            setDecks(enriched);
          }
        }
      } finally {
        if (generation === loadGenRef.current) {
          setIsLoading(false);
          pendingLoadRef.current = null;
        }
      }
    };

    pendingLoadRef.current = doLoad();
    return pendingLoadRef.current;
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
