import { databaseService } from './database/DatabaseService';
import { EXAM_COMPRESSION_WINDOW_DAYS } from './database/migrations';

function parseDateString(dateStr: string): Date {
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // YYYY-MM-DD
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // DD-MM-YYYY
  const [d, m, y] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Returns today in DD-MM-YYYY format (the app's canonical date storage format) */
function formatTodayForSQL(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export class ExamSchedulerService {
  /**
   * Busca el examen más próximo vinculado a un deck (linked_deck_id)
   * y devuelve un multiplicador de compresión (0.2 – 1.0).
   * Si no hay examen vinculado al deck, cae a subject_id como fallback.
   * 0.2 → 20% del intervalo original (máxima compresión).
   * 1.0 → sin compresión.
   */
  static async getCompressionMultiplier(deckId: string | number | null, subjectId?: string | number | null): Promise<number> {
    if (deckId == null && subjectId == null) return 1.0;

    try {
      const db = databaseService.getDb();
      let rows;

      if (deckId != null) {
        const today = formatTodayForSQL();
        rows = await db.getAllAsync(
          `SELECT start_date FROM calendar_events
           WHERE linked_deck_id = ?
             AND start_date >= ?
           ORDER BY start_date ASC
           LIMIT 1`,
          String(deckId),
          today,
        );
      }

      if (!rows || rows.length === 0) {
        if (subjectId != null) {
          const today = formatTodayForSQL();
          rows = await db.getAllAsync(
            `SELECT start_date FROM calendar_events
             WHERE event_type IN ('exam', 'task') AND subject_id = ?
               AND start_date >= ?
             ORDER BY start_date ASC
             LIMIT 1`,
            String(subjectId),
            today,
          );
        }
      }

      if (!rows || rows.length === 0) return 1.0;

      const examDateStr = (rows[0] as any).start_date;
      if (!examDateStr) return 1.0;

      const examDate = parseDateString(examDateStr);
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const daysUntilExam = daysBetween(examDate, now);
      if (daysUntilExam <= 0) return 1.0;
      if (daysUntilExam >= EXAM_COMPRESSION_WINDOW_DAYS) return 1.0;

      return Math.max(0.2, daysUntilExam / EXAM_COMPRESSION_WINDOW_DAYS);
    } catch {
      return 1.0;
    }
  }

  /**
   * Aplica compresión a un intervalo base en milisegundos.
   */
  static async compressInterval(
    deckId: string | number | null,
    baseIntervalMs: number,
    subjectId?: string | number | null,
  ): Promise<number> {
    const multiplier = await this.getCompressionMultiplier(deckId, subjectId);
    return Math.round(baseIntervalMs * multiplier);
  }

  /**
   * Dada una lista de cards con deck_id, busca el examen vinculado a cada deck
   * y reordena dando prioridad a los que tienen examen próximo (menor compressionMultiplier = mayor prioridad).
   */
  static async prioritizeCardsByExam<T extends { deck_id?: string | number }>(
    cards: T[],
  ): Promise<T[]> {
    const multipliers = new Map<string | number, number>();
    const seen = new Set<string | number>();

    for (const card of cards) {
      const did = card.deck_id;
      if (did == null || seen.has(did)) continue;
      seen.add(did);
      const m = await this.getCompressionMultiplier(did ?? null);
      multipliers.set(did, m);
    }

    return [...cards].sort((a, b) => {
      const ma = multipliers.get(a.deck_id!) ?? 1.0;
      const mb = multipliers.get(b.deck_id!) ?? 1.0;
      return ma - mb;
    });
  }
}
