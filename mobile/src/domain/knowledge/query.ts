import type { SQLiteDatabase } from 'expo-sqlite';
import { calculateRetrievability } from './retrievability';

export interface CardRow {
  id: string;
  deck_id: string;
  subject_id: string | null;
  subject_name: string;
  status: string;
  next_review_date: string | null;
  last_review_timestamp: string | null;
  fsrs_stability: number | null;
  fsrs_difficulty: number | null;
  fsrs_repetitions: number | null;
}

export interface SubjectAggregate {
  subjectId: string;
  subjectName: string;
  totalCards: number;
  dueCards: number;
  masteredCards: number;
  learningCards: number;
  newCards: number;
  avgRetrievability: number;
  avgStability: number;
  avgDifficulty: number;
  maxStability: number;
  minStability: number;
  matureCards: number;
  daysSinceLastReview: number;
}

export interface KnowledgeAggregation {
  subjects: SubjectAggregate[];
  totalCards: number;
  totalDecks: number;
  totalSubjects: number;
  daysSinceLastReview: number;
  now: Date;
}

function elapsedDays(timestamp: string | null | undefined, now: Date): number {
  if (!timestamp) return 0;
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Single-query knowledge aggregation for KnowledgeProjection.
 *
 * One DB round-trip returns all card-level data.
 * Aggregation happens in memory (retrievability requires JS).
 */
export async function getKnowledgeAggregation(
  db: SQLiteDatabase,
  userId: string
): Promise<KnowledgeAggregation> {
  const now = new Date();

  const rows = await db.getAllAsync(
    `SELECT
       fc.id, fc.deck_id, fc.status,
       fc.next_review_date, fc.last_review_timestamp,
       fc.fsrs_stability, fc.fsrs_difficulty, fc.fsrs_repetitions,
       fd.subject_id,
       COALESCE(s.name, '') as subject_name
     FROM flashcards fc
     JOIN flashcard_decks fd ON fc.deck_id = fd.id
     LEFT JOIN subjects s ON fd.subject_id = s.id AND s.deleted_at IS NULL
     WHERE fd.user_id = ?
     AND fc.deleted_at IS NULL
     AND fd.deleted_at IS NULL`,
    userId
  ) as CardRow[];

  const subjectMap = new Map<string, {
    subjectId: string;
    subjectName: string;
    cards: CardRow[];
  }>();

  let latestTimestamp: string | null = null;
  const deckIds = new Set<string>();

  for (const row of rows) {
    deckIds.add(row.deck_id);
    if (row.last_review_timestamp && (!latestTimestamp || row.last_review_timestamp > latestTimestamp)) {
      latestTimestamp = row.last_review_timestamp;
    }
    const sid = row.subject_id || '__unsorted__';
    if (!subjectMap.has(sid)) {
      subjectMap.set(sid, {
        subjectId: sid,
        subjectName: row.subject_name || 'Sin materia',
        cards: [],
      });
    }
    subjectMap.get(sid)!.cards.push(row);
  }

  const subjects: SubjectAggregate[] = [];

  for (const [_, group] of subjectMap) {
    let totalCards = 0;
    let dueCards = 0;
    let masteredCards = 0;
    let learningCards = 0;
    let newCards = 0;
    let matureCards = 0;
    let sumRetrievability = 0;
    let sumStability = 0;
    let sumDifficulty = 0;
    let maxStability = 0;
    let minStability = Infinity;
    let lastReviewForSubject: string | null = null;

    for (const card of group.cards) {
      totalCards++;
      const stability = card.fsrs_stability ?? 1.0;

      if (card.last_review_timestamp && (!lastReviewForSubject || card.last_review_timestamp > lastReviewForSubject)) {
        lastReviewForSubject = card.last_review_timestamp;
      }

      sumStability += stability;
      sumDifficulty += card.fsrs_difficulty ?? 0.5;
      maxStability = Math.max(maxStability, stability);
      if (stability > 0) minStability = Math.min(minStability, stability);

      if (card.status === 'mastered') {
        masteredCards++;
      }
      if (card.status === 'learning' || card.status === 'review') {
        learningCards++;
      }
      if (card.status === 'new') {
        newCards++;
      }
      if ((card.fsrs_repetitions ?? 0) >= 3) {
        matureCards++;
      }

      // Due: next_review_date <= now AND not mastered/archived
      if (
        card.next_review_date &&
        card.next_review_date <= now.toISOString() &&
        card.status !== 'mastered' &&
        card.status !== 'archived'
      ) {
        dueCards++;
      }

      // Retrievability from FSRS params
      const elDays = elapsedDays(
        card.last_review_timestamp || card.next_review_date,
        now
      );
      sumRetrievability += calculateRetrievability(stability, elDays);
    }

    const count = group.cards.length;
    subjects.push({
      subjectId: group.subjectId,
      subjectName: group.subjectName,
      totalCards: count,
      dueCards,
      masteredCards,
      learningCards,
      newCards,
      avgRetrievability: count > 0 ? Math.round((sumRetrievability / count) * 10000) / 100 : 0,
      avgStability: count > 0 ? Math.round((sumStability / count) * 100) / 100 : 0,
      avgDifficulty: count > 0 ? Math.round((sumDifficulty / count) * 100) / 100 : 0,
      maxStability: maxStability > 0 ? maxStability : 0,
      minStability: minStability < Infinity ? minStability : 0,
      matureCards,
      daysSinceLastReview: lastReviewForSubject ? Math.round(elapsedDays(lastReviewForSubject, now)) : 999,
    });
  }

  subjects.sort((a, b) => a.avgRetrievability - b.avgRetrievability);

  const daysSinceLastReview = latestTimestamp
    ? Math.round(elapsedDays(latestTimestamp, now))
    : 999;

  return {
    subjects,
    totalCards: rows.length,
    totalDecks: deckIds.size,
    totalSubjects: subjects.length,
    daysSinceLastReview,
    now,
  };
}
