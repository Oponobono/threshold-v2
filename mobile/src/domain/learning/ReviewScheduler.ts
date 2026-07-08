import { databaseService } from '../../services/database/DatabaseService';
import { calculateElapsedDays } from '../../domain/fsrs/calculateElapsedDays';
import { calculateRetrievability } from '../../domain/knowledge/retrievability';
import type { PredictionResponse, PredictionItem } from '../../services/api/analytics';

/**
 * ReviewScheduler
 *
 * Responsable de la "Agenda de Estudio" (qué repasar y cuándo).
 * El mastery ahora es retrievability real de FSRS, no failure_rate legacy.
 */
export class ReviewScheduler {

  /**
   * Obtiene la agenda de estudio basada en retrievability real de FSRS.
   * Sin failure_rate, sin card_logs, sin pending reviews.
   */
  static async getStudySchedule(userId: string): Promise<PredictionResponse> {
    const now = new Date();

    const allDue: any[] = [];
    try {
      const rows = await databaseService.getAllTracked(
        `SELECT
           fc.id, fc.front, fc.deck_id, fc.status,
           fc.next_review_date, fc.last_review_timestamp,
           fc.fsrs_stability, fc.fsrs_difficulty, fc.fsrs_repetitions,
           COALESCE((SELECT name FROM subjects WHERE id = fd.subject_id AND deleted_at IS NULL), '') as subject_name,
           fd.title as deck_title,
           fd.subject_id
         FROM flashcards fc
         JOIN flashcard_decks fd ON fc.deck_id = fd.id
         WHERE fd.user_id = ?
         AND fc.deleted_at IS NULL
         AND fd.deleted_at IS NULL
         AND IFNULL(fc.status, '') NOT IN ('mastered', 'archived')
         AND fc.next_review_date IS NOT NULL
         AND fc.next_review_date <= ?`,
        userId, now.toISOString()
      ) as any[];
      allDue.push(...(rows || []));
    } catch (error) {
      console.warn('[ReviewScheduler] Error fetching study schedule:', error);
    }

    if (allDue.length === 0) {
      return { dueCount: 0, dueCardsCount: 0, deckCount: 0, dueDeckCount: 0, cards: [], dueDeckIds: [] };
    }

    const uniqueDeckIds = new Set(allDue.map(c => String(c.deck_id)));
    const dueDeckCount = uniqueDeckIds.size;

    const cards: PredictionItem[] = allDue.map(c => {
      const stability = c.fsrs_stability ?? 1.0;
      const elapsedDays = calculateElapsedDays(c.last_review_timestamp || c.next_review_date, now);
      const retrievability = calculateRetrievability(stability, elapsedDays);
      const mastery = Math.max(0, Math.min(100, Math.round(retrievability * 100)));
      return {
        cardId: Number(c.id),
        question: c.front || '',
        deckId: c.deck_id,
        deckTitle: c.deck_title || '',
        subjectId: c.subject_id || 0,
        mastery,
        urgency: mastery < 50 ? 'HIGH' as const : 'MEDIUM' as const,
        failureRate: Math.round((1 - retrievability) * 100),
      };
    });

    cards.sort((a, b) => a.mastery - b.mastery);

    return {
      dueCount: dueDeckCount,
      dueCardsCount: allDue.length,
      deckCount: dueDeckCount,
      dueDeckCount: dueDeckCount,
      cards: cards,
      dueDeckIds: Array.from(uniqueDeckIds),
    };
  }
}
