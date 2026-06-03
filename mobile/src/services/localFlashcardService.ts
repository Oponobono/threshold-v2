import { cacheService, saveToCacheSync, loadFromCacheSync, CACHE_KEYS } from './cacheService';
import { getUserId } from './api';

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

export function getLocalDecks(): LocalDeck[] {
  return loadFromCacheSync<LocalDeck[]>(LOCAL_DECKS_KEY, Infinity) || [];
}

function saveLocalDecks(decks: LocalDeck[]): void {
  saveToCacheSync(LOCAL_DECKS_KEY, decks);
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

/**
 * OFFLINE-FIRST: Exporta un mazo local a JSON sin exponer user_id (seguridad)
 * Funciona completamente offline leyendo del cache local
 * @param deckId - ID del mazo a exportar
 * @returns JSON seguro del mazo para compartir/respaldar
 */
export async function exportDeckToJSON(deckId: number): Promise<any> {
  try {
    // Obtener el mazo
    const allDecks = getLocalDecks();
    const deck = allDecks.find(d => d.id === deckId);
    
    if (!deck) {
      throw new Error(`Mazo ${deckId} no encontrado`);
    }

    // Obtener las tarjetas del mazo
    const cardsKey = `${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`;
    const cards = loadFromCacheSync<any[]>(cardsKey, Infinity) || [];

    // Construir JSON de exportación SIN user_id (SEGURIDAD)
    const exportData = {
      title: deck.title,
      description: deck.description || '',
      // NO incluir subject_id - será seleccionado durante importación
      // NO incluir user_id - será asignado por el backend/app que importa
      cards: cards.map(card => {
        const cardExport: any = {
          type: card.item_type || 'flashcard',
        };

        // Incluir datos del contenido
        if (card.content) {
          cardExport.data = card.content;
        } else if (card.item_type === 'flashcard') {
          // Fallback para tarjetas antiguas
          cardExport.data = {
            front: card.front || '',
            back: card.back || '',
          };
        }

        // Incluir opcional metadata
        if (card.hint) {
          cardExport.hint = card.hint;
        }
        if (card.explanation) {
          cardExport.explanation = card.explanation;
        }

        return cardExport;
      }),
    };

    console.log(`[LocalFlashcard] Mazo ${deckId} exportado: ${exportData.cards.length} tarjetas`);
    return exportData;
  } catch (error) {
    console.error('[LocalFlashcard] Error exportando mazo:', error);
    throw error;
  }
}

/**
 * OFFLINE-FIRST: Prepara sincronización de mazos importados cuando vuelve online
 * Marca mazos locales para sincronizar con el backend
 * @param deckId - ID local del mazo importado
 * @param userId - ID del usuario autenticado
 */
export async function prepareDeckForSync(deckId: number, userId: number): Promise<void> {
  try {
    const decks = getLocalDecks();
    const idx = decks.findIndex(d => d.id === deckId);
    
    if (idx === -1) {
      throw new Error(`Mazo ${deckId} no encontrado`);
    }

    const deck = decks[idx];

    // Asegurar que el user_id sea el correcto (seguridad)
    if (deck.user_id !== userId) {
      console.warn(`[LocalFlashcard] Corrigiendo user_id de mazo: ${deck.user_id} → ${userId}`);
      decks[idx] = { ...deck, user_id: userId };
      saveLocalDecks(decks);
    }

    // OFFLINE-FIRST: Obtener tarjetas del mazo para incluirlas en la sincronización
    const cardsKey = `${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`;
    const cards = loadFromCacheSync<any[]>(cardsKey, Infinity) || [];

    // Preparar payload de sincronización con todas las tarjetas
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

    // Encolar en offlineSyncService para sincronizar cuando vuelva online
    const { offlineSyncService } = await import('./offlineSyncService');
    await offlineSyncService.addPendingOperation(
      'POST',
      '/flashcard-decks',
      'flashcard_deck',
      deckPayload
    );

    // Marcar como preparado para tracking
    const syncKey = `sync:deck_pending:${deckId}`;
    const storage = require('react-native-mmkv').createMMKV();
    storage.set(syncKey, JSON.stringify({ deckId, userId, status: 'pending', timestamp: Date.now() }));

    console.log(`[LocalFlashcard] Mazo ${deckId} preparado para sincronizar con ${cards.length} tarjetas`);
  } catch (error) {
    console.error('[LocalFlashcard] Error preparando mazo para sync:', error);
    throw error;
  }
}

/**
 * OFFLINE-FIRST: Obtiene mazos locales pendientes de sincronización
 * @returns Mazos que necesitan sincronizar con el backend
 */
export function getPendingDecksForSync(): LocalDeck[] {
  try {
    const localDecks = getLocalDecks();
    // Retornar mazos marcados como _local que aún no han sido sincronizados
    return localDecks.filter(d => d._local === true && d.id < 0);
  } catch (error) {
    console.error('[LocalFlashcard] Error obteniendo mazos pendientes:', error);
    return [];
  }
}

/**
 * OFFLINE-FIRST: Edita información de un mazo local (título, materia)
 * Funciona offline actualizando cache local
 * @param deckId - ID del mazo (puede ser local, negativo)
 * @param updates - Cambios a aplicar
 */
export function updateLocalDeck(deckId: number, updates: Partial<LocalDeck>): void {
  try {
    const decks = getLocalDecks();
    const idx = decks.findIndex(d => d.id === deckId);
    
    if (idx === -1) {
      throw new Error(`Mazo ${deckId} no encontrado`);
    }

    const updated = { ...decks[idx], ...updates };
    decks[idx] = updated;
    saveLocalDecks(decks);
    mergeIntoDecksCache(updated);

    console.log(`[LocalFlashcard] Mazo ${deckId} actualizado: ${JSON.stringify(updates)}`);
  } catch (error) {
    console.error('[LocalFlashcard] Error actualizando mazo:', error);
    throw error;
  }
}

/**
 * OFFLINE-FIRST: Agrega una tarjeta a un mazo local
 * Crea tarjeta localmente con ID temporal
 * @param deckId - ID del mazo (puede ser local, negativo)
 * @param card - Datos de la tarjeta a agregar
 */
export function addLocalCard(deckId: number, card: Omit<LocalCard, 'id'>): void {
  try {
    // Obtener tarjetas existentes
    const cardsKey = `${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`;
    const cards = loadFromCacheSync<any[]>(cardsKey, Infinity) || [];

    // Crear tarjeta con ID temporal
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

    // Agregar a array de tarjetas
    cards.push(newCard);
    saveToCacheSync(cardsKey, cards);
    saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, cards);
    saveToCacheSync(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, cards);

    // Actualizar conteo en el mazo
    const decks = getLocalDecks();
    const idx = decks.findIndex(d => d.id === deckId);
    if (idx >= 0) {
      decks[idx] = {
        ...decks[idx],
        card_count: cards.length,
        new_count: (decks[idx].new_count || 0) + 1,
      };
      saveLocalDecks(decks);
      mergeIntoDecksCache(decks[idx]);
    }

    console.log(`[LocalFlashcard] Tarjeta agregada a mazo ${deckId}: ${newCard.id}`);
  } catch (error) {
    console.error('[LocalFlashcard] Error agregando tarjeta:', error);
    throw error;
  }
}

/**
 * OFFLINE-FIRST: Elimina una tarjeta de un mazo local
 * @param deckId - ID del mazo (puede ser local, negativo)
 * @param cardId - ID de la tarjeta a eliminar
 */
export function deleteLocalCard(deckId: number, cardId: number): void {
  try {
    // Obtener tarjetas
    const cardsKey = `${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`;
    let cards = loadFromCacheSync<any[]>(cardsKey, Infinity) || [];

    // Encontrar tarjeta a eliminar
    const deletedCard = cards.find(c => c.id === cardId);
    if (!deletedCard) {
      throw new Error(`Tarjeta ${cardId} no encontrada`);
    }

    // Eliminar tarjeta
    cards = cards.filter(c => c.id !== cardId);
    saveToCacheSync(cardsKey, cards);
    saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, cards);
    saveToCacheSync(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, cards);

    // Actualizar conteo en el mazo
    const decks = getLocalDecks();
    const idx = decks.findIndex(d => d.id === deckId);
    if (idx >= 0) {
      const newCount = Math.max(0, (decks[idx].new_count || 0) - (deletedCard.status === 'new' ? 1 : 0));
      decks[idx] = {
        ...decks[idx],
        card_count: cards.length,
        new_count: newCount,
      };
      saveLocalDecks(decks);
      mergeIntoDecksCache(decks[idx]);
    }

    console.log(`[LocalFlashcard] Tarjeta ${cardId} eliminada del mazo ${deckId}`);
  } catch (error) {
    console.error('[LocalFlashcard] Error eliminando tarjeta:', error);
    throw error;
  }
}

/**
 * OFFLINE-FIRST: Edita una tarjeta local
 * @param deckId - ID del mazo (puede ser local, negativo)
 * @param cardId - ID de la tarjeta a editar
 * @param updates - Cambios a aplicar
 */
export function updateLocalCard(deckId: number, cardId: number, updates: Partial<LocalCard>): void {
  try {
    const cardsKey = `${CACHE_KEYS.FLASHCARDS_BY_DECK}${deckId}`;
    const cards = loadFromCacheSync<any[]>(cardsKey, Infinity) || [];

    const idx = cards.findIndex(c => c.id === cardId);
    if (idx === -1) {
      throw new Error(`Tarjeta ${cardId} no encontrada`);
    }

    // Aplicar actualizaciones
    const updated = {
      ...cards[idx],
      ...(updates.data && { content: updates.data, ...(updates.data?.front && { front: updates.data.front }), ...(updates.data?.back && { back: updates.data.back }) }),
      ...(updates.hint !== undefined && { hint: updates.hint }),
      ...(updates.explanation !== undefined && { explanation: updates.explanation }),
    };

    cards[idx] = updated;
    saveToCacheSync(cardsKey, cards);
    saveToCacheSync(`${CACHE_KEYS.FLASHCARDS_PRIORITIZED_BY_DECK}${deckId}`, cards);
    saveToCacheSync(`${CACHE_KEYS.CARDS_NOT_SNOOZED_BY_DECK}${deckId}`, cards);

    console.log(`[LocalFlashcard] Tarjeta ${cardId} actualizada`);
  } catch (error) {
    console.error('[LocalFlashcard] Error actualizando tarjeta:', error);
    throw error;
  }
}
