import { databaseService } from './database/DatabaseService';
import { EXAM_COMPRESSION_WINDOW_DAYS } from './database/migrations';

function parseDDMMYYYY(dateStr: string): Date {
  const [d, m, y] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export class ExamSchedulerService {
  /**
   * Busca el examen más próximo vinculado a un subject_id
   * y devuelve un multiplicador de compresión (0.2 – 1.0).
   * 0.2 → 20% del intervalo original (máxima compresión).
   * 1.0 → sin compresión.
   */
  static async getCompressionMultiplier(subjectId: string | number | null): Promise<number> {
    if (subjectId == null) return 1.0;

    try {
      const db = databaseService.getDb();
      const rows = await db.getAllAsync(
        `SELECT start_date FROM calendar_events
         WHERE event_type = 'exam' AND subject_id = ?
         ORDER BY start_date ASC
         LIMIT 1`,
        String(subjectId),
      );

      if (!rows || rows.length === 0) return 1.0;

      const examDateStr = (rows[0] as any).start_date;
      if (!examDateStr) return 1.0;

      const examDate = parseDDMMYYYY(examDateStr);
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
    subjectId: string | number | null,
    baseIntervalMs: number,
  ): Promise<number> {
    const multiplier = await this.getCompressionMultiplier(subjectId);
    return Math.round(baseIntervalMs * multiplier);
  }

  /**
   * Dada una lista de cards con deck_id, busca el subject_id del deck
   * y reordena dando prioridad a las que pertenecen a materias con
   * examen próximo (menor compressionMultiplier = mayor prioridad).
   */
  static async prioritizeCardsByExam<T extends { deck_id?: string | number }>(
    cards: T[],
    deckIdToSubjectId: Record<string, string | number | null>,
  ): Promise<T[]> {
    const multipliers = new Map<string | number, number>();
    const seen = new Set<string | number>();

    for (const card of cards) {
      const did = card.deck_id;
      if (did == null || seen.has(did)) continue;
      seen.add(did);
      const sid = deckIdToSubjectId[String(did)];
      const m = await this.getCompressionMultiplier(sid ?? null);
      multipliers.set(did, m);
    }

    return [...cards].sort((a, b) => {
      const ma = multipliers.get(a.deck_id!) ?? 1.0;
      const mb = multipliers.get(b.deck_id!) ?? 1.0;
      return ma - mb;
    });
  }
}
