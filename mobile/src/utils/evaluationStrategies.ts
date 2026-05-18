/**
 * evaluationStrategies.ts
 *
 * Implementación del Patrón de Estrategia (Strategy Pattern) para el motor de
 * evaluación multiformato de Threshold. Cada tipo de ítem tiene su propia
 * estrategia de calificación con una interfaz común.
 *
 * Uso:
 *   const strategy = StrategyFactory.getStrategy(item.item_type);
 *   const result = strategy.evaluate(item, userAnswer, responseTimeMs);
 *   const newStatus = strategy.getStatusUpdate(result);
 */

import {
  EvaluationItem,
  EvaluationItemType,
  EvaluationResult,
  MultipleChoiceContent,
  BooleanContent,
} from '../services/api/types';

// ─── Interfaz Base del Strategy ──────────────────────────────────────────────

export interface EvaluationStrategy {
  /** Califica la respuesta del usuario y produce un EvaluationResult */
  evaluate(item: EvaluationItem, answer: unknown, responseTimeMs: number): EvaluationResult;
  /** Determina el nuevo estado de repetición espaciada para la BD */
  getStatusUpdate(result: EvaluationResult): 'learning' | 'review';
  /** Si la estrategia requiere que el usuario revele la respuesta antes de calificar */
  requiresReveal: boolean;
}

// ─── FlashcardStrategy ───────────────────────────────────────────────────────

/**
 * La calificación es subjetiva: el usuario decide si "lo sabía" o le resultó difícil.
 * Requiere revelar la respuesta (flip) antes de calificar.
 */
export class FlashcardStrategy implements EvaluationStrategy {
  readonly requiresReveal = true;

  evaluate(item: EvaluationItem, answer: 'learning' | 'review', responseTimeMs: number): EvaluationResult {
    return {
      itemId: item.id,
      itemType: 'flashcard',
      passed: answer === 'review',
      responseTimeMs,
      selfRating: answer,
    };
  }

  getStatusUpdate(result: EvaluationResult): 'learning' | 'review' {
    return result.selfRating ?? 'learning';
  }
}

// ─── MultipleChoiceStrategy ──────────────────────────────────────────────────

/**
 * La calificación es automática y binaria: ¿el índice seleccionado == correctIndex?
 * No requiere revelar; el feedback es inmediato.
 */
export class MultipleChoiceStrategy implements EvaluationStrategy {
  readonly requiresReveal = false;

  evaluate(item: EvaluationItem, answer: number, responseTimeMs: number): EvaluationResult {
    const content = item.content as MultipleChoiceContent;
    return {
      itemId: item.id,
      itemType: 'multiple_choice',
      passed: answer === content.correctIndex,
      responseTimeMs,
      selectedAnswer: answer,
    };
  }

  getStatusUpdate(result: EvaluationResult): 'learning' | 'review' {
    return result.passed ? 'review' : 'learning';
  }
}

// ─── BooleanStrategy ─────────────────────────────────────────────────────────

/**
 * La calificación es automática: ¿selectedAnswer === correctAnswer?
 * No requiere revelar; el feedback es inmediato.
 */
export class BooleanStrategy implements EvaluationStrategy {
  readonly requiresReveal = false;

  evaluate(item: EvaluationItem, answer: boolean, responseTimeMs: number): EvaluationResult {
    const content = item.content as BooleanContent;
    return {
      itemId: item.id,
      itemType: 'boolean',
      passed: answer === content.correctAnswer,
      responseTimeMs,
      selectedAnswer: answer,
    };
  }

  getStatusUpdate(result: EvaluationResult): 'learning' | 'review' {
    return result.passed ? 'review' : 'learning';
  }
}

// ─── Strategy Factory ─────────────────────────────────────────────────────────

export const StrategyFactory = {
  getStrategy(type: EvaluationItemType): EvaluationStrategy {
    switch (type) {
      case 'flashcard':       return new FlashcardStrategy();
      case 'multiple_choice': return new MultipleChoiceStrategy();
      case 'boolean':         return new BooleanStrategy();
      default:                return new FlashcardStrategy();
    }
  },
};

// ─── Adapter: Flashcard[] → EvaluationItem[] ─────────────────────────────────

/**
 * Convierte el formato legacy `Flashcard` al nuevo `EvaluationItem`.
 * Garantiza compatibilidad con mazos existentes en la BD sin `item_type`.
 */
export function adaptFlashcardsToEvaluationItems(cards: any[]): EvaluationItem[] {
  return cards.map((card) => {
    const itemType: EvaluationItemType = card.item_type || 'flashcard';
    let content = card.content;

    if (!content) {
      if (itemType === 'flashcard') {
        content = { front: card.front || '', back: card.back || '' };
      } else {
        try { 
          content = JSON.parse(card.content_json || '{}'); 
          // Normalizar llaves para datos existentes importados con snake_case
          if (content.correct_index !== undefined) {
            content.correctIndex = content.correct_index;
          }
          if (content.correct_answer !== undefined) {
            content.correctAnswer = content.correct_answer;
          }
        } catch { 
          content = {}; 
        }
      }
    }

    return {
      id: card.id,
      deck_id: card.deck_id,
      item_type: itemType,
      content,
      hint: card.hint || null,
      explanation: card.explanation || null,
      status: card.status || 'new',
      created_at: card.created_at,
      front: card.front,
      back: card.back,
    };
  });
}
