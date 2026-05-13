/**
 * useDueCardSnooze.ts
 * 
 * Hook para gestionar el aplazamiento inteligente de tarjetas vencidas.
 * Basado en principios de spaced repetition (espaciamiento) del algoritmo SM-2.
 * 
 * El aplazamiento es un mecanismo para diferir la revisión manteniendo el contexto
 * de aprendizaje, permitiendo que el usuario revise después sin perder momentum.
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SnoozeOption {
  label: string;
  minutes: number;
  description: string;
  icon: string;
  pedagogical: string; // Justificación pedagógica
}

/**
 * Opciones de snooze basadas en principios de spaced repetition
 * y ciclos de aprendizaje efectivos.
 */
export const SNOOZE_OPTIONS: SnoozeOption[] = [
  {
    label: 'En 30 min',
    minutes: 30,
    description: 'Mantén el momentum - revisa en la próxima sesión corta',
    icon: 'timer-outline',
    pedagogical: 'Revisión inmediata para consolidar memoria a corto plazo',
  },
  {
    label: 'En 4 horas',
    minutes: 240,
    description: 'Retoma después de otras actividades',
    icon: 'clock-outline',
    pedagogical: 'Intervalo óptimo para refuerzo antes de olvido (curva Ebbinghaus)',
  },
  {
    label: 'Mañana',
    minutes: 1440,
    description: 'Revisa en la próxima sesión de estudio',
    icon: 'calendar-check',
    pedagogical: 'Revisión del día siguiente consolida a memoria largo plazo',
  },
  {
    label: 'En 3 días',
    minutes: 4320,
    description: 'Retoma en la próxima sesión importante',
    icon: 'calendar-multiple',
    pedagogical: 'Fase crítica de SM-2 antes del olvido (~70% retención)',
  },
];

interface SnoozedCard {
  id: string;
  snoozedAt: number;
  resumeAt: number;
}

const SNOOZE_STORAGE_KEY = '@threshold_snoozed_cards';

/**
 * Hook para gestionar el estado de snooze de tarjetas vencidas.
 * Almacena en AsyncStorage para persistencia entre sesiones.
 */
export const useDueCardSnooze = () => {
  const [snoozedCards, setSnoozedCards] = useState<Map<string, SnoozedCard>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Cargar snoozes guardados al montar el componente
  useEffect(() => {
    loadSnoozeState();
  }, []);

  const loadSnoozeState = async () => {
    try {
      const stored = await AsyncStorage.getItem(SNOOZE_STORAGE_KEY);
      if (stored) {
        const cards = JSON.parse(stored) as Record<string, SnoozedCard>;
        const now = Date.now();

        // Filtrar tarjetas cuyo snooze ya expiró
        const activeSnoozes = Object.entries(cards).reduce((acc, [id, card]) => {
          if (card.resumeAt > now) {
            acc[id] = card;
          }
          return acc;
        }, {} as Record<string, SnoozedCard>);

        // Guardar solo los activos
        await AsyncStorage.setItem(
          SNOOZE_STORAGE_KEY,
          JSON.stringify(activeSnoozes)
        );

        setSnoozedCards(new Map(Object.entries(activeSnoozes)));
      }
    } catch (error) {
      console.warn('[useDueCardSnooze] Error loading snooze state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Aplazar una tarjeta por el tiempo especificado (en minutos).
   * Almacena tanto el timestamp de snooze como cuándo debe reaparecer.
   */
  const snoozeCard = useCallback(
    async (cardId: string, snoozeMinutes: number) => {
      try {
        const now = Date.now();
        const snoozeMs = snoozeMinutes * 60 * 1000;
        const resumeAt = now + snoozeMs;

        const newSnooze: SnoozedCard = {
          id: cardId,
          snoozedAt: now,
          resumeAt,
        };

        // Actualizar estado local
        const updated = new Map(snoozedCards);
        updated.set(cardId, newSnooze);
        setSnoozedCards(updated);

        // Persistir en AsyncStorage
        const allSnoozes = Object.fromEntries(updated);
        await AsyncStorage.setItem(
          SNOOZE_STORAGE_KEY,
          JSON.stringify(allSnoozes)
        );

        return newSnooze;
      } catch (error) {
        console.error('[useDueCardSnooze] Error snoozing card:', error);
        throw error;
      }
    },
    [snoozedCards]
  );

  /**
   * Cancelar el snooze de una tarjeta (hacerla visible nuevamente).
   */
  const unsnoozeCard = useCallback(
    async (cardId: string) => {
      try {
        const updated = new Map(snoozedCards);
        updated.delete(cardId);
        setSnoozedCards(updated);

        const allSnoozes = Object.fromEntries(updated);
        await AsyncStorage.setItem(
          SNOOZE_STORAGE_KEY,
          JSON.stringify(allSnoozes)
        );
      } catch (error) {
        console.error('[useDueCardSnooze] Error unsnoozing card:', error);
        throw error;
      }
    },
    [snoozedCards]
  );

  /**
   * Verificar si una tarjeta está aplazada.
   */
  const isCardSnoozed = useCallback(
    (cardId: string): boolean => {
      const snooze = snoozedCards.get(cardId);
      if (!snooze) return false;

      const now = Date.now();
      return snooze.resumeAt > now;
    },
    [snoozedCards]
  );

  /**
   * Obtener el tiempo restante en ms para que se reanude una tarjeta.
   */
  const getTimeUntilResume = useCallback(
    (cardId: string): number => {
      const snooze = snoozedCards.get(cardId);
      if (!snooze) return 0;

      const timeLeft = snooze.resumeAt - Date.now();
      return Math.max(0, timeLeft);
    },
    [snoozedCards]
  );

  /**
   * Obtener todas las tarjetas que están actualmente aplazadas.
   */
  const getSnoozedCardIds = useCallback((): string[] => {
    return Array.from(snoozedCards.keys());
  }, [snoozedCards]);

  /**
   * Resetear todos los snoozes (útil para desarrollo/testing).
   */
  const resetAllSnoozes = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(SNOOZE_STORAGE_KEY);
      setSnoozedCards(new Map());
    } catch (error) {
      console.error('[useDueCardSnooze] Error resetting snoozes:', error);
      throw error;
    }
  }, []);

  return {
    snoozeCard,
    unsnoozeCard,
    isCardSnoozed,
    getTimeUntilResume,
    getSnoozedCardIds,
    resetAllSnoozes,
    isLoading,
    snoozedCards,
  };
};
