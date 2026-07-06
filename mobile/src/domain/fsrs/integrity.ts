import type { SQLiteDatabase } from 'expo-sqlite';

export interface FSRSIntegrityIssue {
  cardId: string;
  deckId: string;
  front: string;
  issue: string;
  severity: 'error' | 'warning';
}

export interface FSRSIntegrityReport {
  issues: FSRSIntegrityIssue[];
  totalCards: number;
  nullStability: number;
  nullDifficulty: number;
  nullRepetitions: number;
  inconsistentStatus: number;
  pastDueWithStabilityZero: number;
  healthy: boolean;
}

export async function checkFSRSIntegrity(db: SQLiteDatabase): Promise<FSRSIntegrityReport> {
  const issues: FSRSIntegrityIssue[] = [];

  const allCards = await db.getAllAsync(
    `SELECT id, deck_id, front, status, next_review_date,
            fsrs_stability, fsrs_difficulty, fsrs_repetitions
     FROM flashcards WHERE deleted_at IS NULL`
  ) as any[];

  const totalCards = allCards.length;
  let nullStability = 0;
  let nullDifficulty = 0;
  let nullRepetitions = 0;
  let inconsistentStatus = 0;
  let pastDueWithStabilityZero = 0;

  const now = new Date().toISOString();

  for (const card of allCards) {
    const id = String(card.id);
    const deckId = String(card.deck_id);
    const front = card.front || '';

    // FSRS parameters NULL detection
    if (card.fsrs_stability == null || card.fsrs_stability === 0) {
      nullStability++;
      issues.push({
        cardId: id, deckId, front: front.substring(0, 60),
        issue: card.fsrs_stability === 0
          ? `fsrs_stability=0 (debe ser ≥ 0.1)`
          : 'fsrs_stability IS NULL',
        severity: 'error',
      });
    }
    if (card.fsrs_difficulty == null) {
      nullDifficulty++;
      issues.push({
        cardId: id, deckId, front: front.substring(0, 60),
        issue: 'fsrs_difficulty IS NULL',
        severity: 'error',
      });
    }
    if (card.fsrs_repetitions == null) {
      nullRepetitions++;
      issues.push({
        cardId: id, deckId, front: front.substring(0, 60),
        issue: 'fsrs_repetitions IS NULL',
        severity: 'error',
      });
    }

    // Past due but wrong status
    if (card.next_review_date && card.next_review_date <= now) {
      const validStatuses = ['new', 'learning', 'review'];
      if (!validStatuses.includes(card.status || '')) {
        inconsistentStatus++;
        issues.push({
          cardId: id, deckId, front: front.substring(0, 60),
          issue: `next_review_date past (${card.next_review_date}) but status='${card.status}'`,
          severity: 'warning',
        });
      }
    }

    // Past due with stability = 0
    if (card.next_review_date && card.next_review_date <= now && card.fsrs_stability === 0) {
      pastDueWithStabilityZero++;
    }
  }

  return {
    issues,
    totalCards,
    nullStability,
    nullDifficulty,
    nullRepetitions,
    inconsistentStatus,
    pastDueWithStabilityZero,
    healthy: nullStability === 0 && nullDifficulty === 0 && nullRepetitions === 0 && pastDueWithStabilityZero === 0,
  };
}

export function formatIntegrityReport(report: FSRSIntegrityReport): string {
  const lines: string[] = [];
  lines.push(`=== FSRS Integrity Report ===`);
  lines.push(`Total cards: ${report.totalCards}`);
  lines.push(`Null/Zero stability: ${report.nullStability}`);
  lines.push(`Null difficulty: ${report.nullDifficulty}`);
  lines.push(`Null repetitions: ${report.nullRepetitions}`);
  lines.push(`Inconsistent status: ${report.inconsistentStatus}`);
  lines.push(`Past-due with stability=0: ${report.pastDueWithStabilityZero}`);
  lines.push(`Healthy: ${report.healthy ? 'YES' : 'NO'}`);
  if (report.issues.length > 0) {
    lines.push(`\nIssues (${report.issues.length}):`);
    for (const iss of report.issues.slice(0, 50)) {
      lines.push(`  [${iss.severity}] Card ${iss.cardId.substring(0, 8)}... ${iss.issue}`);
    }
    if (report.issues.length > 50) {
      lines.push(`  ... and ${report.issues.length - 50} more`);
    }
  }
  return lines.join('\n');
}
