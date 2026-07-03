import { databaseService } from '../../services/database/DatabaseService';
import { getPendingReviews } from '../../services/localFlashcardService';
import type { PredictionResponse, PredictionItem } from '../../services/api/analytics';

/**
 * ReviewScheduler
 * 
 * Responsable de la "Agenda de Estudio" (qué repasar y cuándo).
 * Se encarga de aislar la lógica de agendas del cálculo de memoria (FSRS).
 */
export class ReviewScheduler {
  
  /**
   * Obtiene la agenda de estudio basada en next_review_date de SQLite.
   * Filtra las tarjetas archivadas o masterizadas.
   */
  static async getStudySchedule(userId: string): Promise<PredictionResponse> {
    const db = databaseService.getDb();
    const now = new Date().toISOString();

    const sqliteDue: any[] = [];
    try {
      const rows = await db.getAllAsync(
        `SELECT
           fc.id, fc.front, fc.deck_id, fc.status, fc.next_review_date,
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
        userId, now
      ) as any[];
      sqliteDue.push(...(rows || []));
    } catch (error) {
      console.warn('[ReviewScheduler] Error fetching study schedule:', error);
    }

    const allDue = [...sqliteDue];
    
    if (allDue.length === 0) {
      return { dueCount: 0, dueCardsCount: 0, deckCount: 0, dueDeckCount: 0, cards: [], dueDeckIds: [] };
    }

    // Contar mazos únicos con vencidas
    const uniqueDeckIds = new Set(allDue.map(c => String(c.deck_id)));
    const dueDeckCount = uniqueDeckIds.size;

    // Calcular failure rate desde card_logs + pending reviews (para ordenar prioridad de repaso)
    const pendingReviews = getPendingReviews();
    const pendingMap: Record<number, number> = {};
    for (const r of pendingReviews) {
      const cardIdNum = Number(r.cardId);
      if (!pendingMap[cardIdNum]) pendingMap[cardIdNum] = 0;
      pendingMap[cardIdNum]++;
      if (r.grade < 3) pendingMap[cardIdNum] = -999;
    }

    const cardIds = allDue.map(c => c.id).filter(Boolean);
    const failureRateMap: Record<string, number> = {};
    if (cardIds.length > 0) {
      try {
        const placeholders = cardIds.map(() => '?').join(',');
        const logs = await db.getAllAsync(
          `SELECT card_id,
                  CAST(COALESCE(SUM(CASE WHEN result = 'incorrect' THEN 1 ELSE 0 END), 0) AS REAL) /
                  CAST(COALESCE(COUNT(*), 1) AS REAL) as failure_rate
           FROM card_logs WHERE card_id IN (${placeholders}) GROUP BY card_id`,
          ...cardIds
        ) as any[];
        for (const row of logs) {
          failureRateMap[row.card_id] = row.failure_rate || 0;
        }
      } catch {}
    }

    // Construir predicciones para la agenda
    const cards: PredictionItem[] = allDue.map(c => {
      const fr = failureRateMap[c.id] ?? (pendingMap[c.id] === -999 ? 1 : 0);
      const mastery = Math.max(0, Math.round((1 - fr) * 100));
      return {
        cardId: Number(c.id),
        question: c.front || '',
        deckId: c.deck_id,
        deckTitle: c.deck_title || '',
        subjectId: c.subject_id || 0,
        mastery,
        urgency: mastery < 50 ? 'HIGH' as const : 'MEDIUM' as const,
        failureRate: Math.round(fr * 100),
      };
    });

    cards.sort((a, b) => a.mastery - b.mastery);

    return {
      dueCount: dueDeckCount,
      dueCardsCount: allDue.length,
      deckCount: dueDeckCount,
      dueDeckCount: dueDeckCount,
      cards: cards.slice(0, 20),
      dueDeckIds: Array.from(uniqueDeckIds)
    };
  }
}
