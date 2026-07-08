import { calculateRetrievability } from './retrievability';
import { databaseService } from '../../services/database/DatabaseService';

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

export interface AggregationTiming {
  sqlQueryMs: number;
  bridgeTransferMs: number;
  loopGroupingMs: number;
  loopAggregationMs: number;
  calculateRetrievabilityMs: number;
  elapsedDaysMs: number;
  mapOperationsMs: number;
  buildSubjectsMs: number;
  totalMs: number;
  rowsReturned: number;
  columnsPerRow: number;
  subjectCount: number;
  cardCount: number;
}

function elapsedDays(timestamp: string | null | undefined, now: Date): number {
  if (!timestamp) return 0;
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getKnowledgeAggregation(
  userId: string
): Promise<KnowledgeAggregation> {
  const _t = Date.now();
  const now = new Date();

  // ── SQL query ────────────────────────────────────────────────
  const _tQuery = Date.now();
  const rows = await databaseService.getAllTracked<CardRow>(
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
    [userId],
    'Knowledge aggregation query'
  );
  const _tQueryEnd = Date.now();

  // ── Loop 1: Grouping by subject ─────────────────────────────
  const _tGroup = Date.now();
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
  const _tGroupEnd = Date.now();

  // ── Loop 2: Aggregation per subject ─────────────────────────
  const _tAgg = Date.now();
  const subjects: SubjectAggregate[] = [];
  let _tRetriev = 0;
  let _tElapsed = 0;

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

      if (card.status === 'mastered') { masteredCards++; }
      if (card.status === 'learning' || card.status === 'review') { learningCards++; }
      if (card.status === 'new') { newCards++; }
      if ((card.fsrs_repetitions ?? 0) >= 3) { matureCards++; }

      if (
        card.next_review_date &&
        card.next_review_date <= now.toISOString() &&
        card.status !== 'mastered' &&
        card.status !== 'archived'
      ) {
        dueCards++;
      }

      const _tE = Date.now();
      const elDays = elapsedDays(
        card.last_review_timestamp || card.next_review_date,
        now
      );
      _tElapsed += Date.now() - _tE;

      const _tR = Date.now();
      sumRetrievability += calculateRetrievability(stability, elDays);
      _tRetriev += Date.now() - _tR;
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
  const _tAggEnd = Date.now();

  // ── Final assembly ──────────────────────────────────────────
  const _tBuild = Date.now();
  subjects.sort((a, b) => a.avgRetrievability - b.avgRetrievability);

  const daysSinceLastReview = latestTimestamp
    ? Math.round(elapsedDays(latestTimestamp, now))
    : 999;

  // Count real subjects (incl. those sin flashcards)
  const subjectCountRow = await databaseService.getFirstTracked<{ count: number }>(
    `SELECT COUNT(*) as count FROM subjects WHERE user_id = ? AND deleted_at IS NULL`,
    [userId],
    'Knowledge subject count'
  );
  const totalSubjectCount = Math.max(subjectCountRow?.count ?? 0, subjects.length);

  const result: KnowledgeAggregation = {
    subjects,
    totalCards: rows.length,
    totalDecks: deckIds.size,
    totalSubjects: totalSubjectCount,
    daysSinceLastReview,
    now,
  };
  const _tEnd = Date.now();

  // ── Instrumentation ─────────────────────────────────────────
  const sqMs = _tQueryEnd - _tQuery;
  const bridgeMs = _tGroup - _tQueryEnd;
  const groupMs = _tGroupEnd - _tGroup;
  const aggMs = _tAggEnd - _tAgg;
  const buildMs = _tEnd - _tBuild;
  const totalMs = _tEnd - _t;

  const colCount = 10;
  const timing: AggregationTiming = {
    sqlQueryMs: sqMs,
    bridgeTransferMs: bridgeMs,
    loopGroupingMs: groupMs,
    loopAggregationMs: aggMs,
    calculateRetrievabilityMs: _tRetriev,
    elapsedDaysMs: _tElapsed,
    mapOperationsMs: groupMs,
    buildSubjectsMs: buildMs,
    totalMs,
    rowsReturned: rows.length,
    columnsPerRow: colCount,
    subjectCount: subjects.length,
    cardCount: rows.length,
  };

  const BAR = (ms: number, total: number) => {
    const pct = total > 0 ? ms / total : 0;
    return '█'.repeat(Math.min(Math.round(pct * 40), 40)).padEnd(40);
  };

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AggregationProfiler] getKnowledgeAggregation breakdown');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Phase                        Duration     %Total   Timeline');
  console.log('  ──────────────────────────────────────────────────────────');
  console.log(`  SQL query              ${String(sqMs).padStart(7)}ms  ${(sqMs/totalMs*100).toFixed(1).padStart(5)}%  ${BAR(sqMs, totalMs)}`);
  console.log(`  JSI bridge transfer    ${String(bridgeMs).padStart(7)}ms  ${(bridgeMs/totalMs*100).toFixed(1).padStart(5)}%  ${BAR(bridgeMs, totalMs)}`);
  console.log(`  Loop 1 — grouping      ${String(groupMs).padStart(7)}ms  ${(groupMs/totalMs*100).toFixed(1).padStart(5)}%  ${BAR(groupMs, totalMs)}`);
  console.log(`  Loop 2 — aggregation   ${String(aggMs).padStart(7)}ms  ${(aggMs/totalMs*100).toFixed(1).padStart(5)}%  ${BAR(aggMs, totalMs)}`);
  console.log(`    ├─ elapsedDays()     ${String(_tElapsed).padStart(7)}ms  ${(_tElapsed/totalMs*100).toFixed(1).padStart(5)}%  ${BAR(_tElapsed, totalMs)}`);
  console.log(`    └─ calculateRetriev() ${String(_tRetriev).padStart(7)}ms  ${(_tRetriev/totalMs*100).toFixed(1).padStart(5)}%  ${BAR(_tRetriev, totalMs)}`);
  console.log(`  Build subjects         ${String(buildMs).padStart(7)}ms  ${(buildMs/totalMs*100).toFixed(1).padStart(5)}%  ${BAR(buildMs, totalMs)}`);
  console.log('  ──────────────────────────────────────────────────────────');
  console.log(`  TOTAL                  ${String(totalMs).padStart(7)}ms  100.0%`);
  console.log(`  Cards: ${timing.cardCount} | Subjects: ${timing.subjectCount} | Rows returned: ${timing.rowsReturned} × ${timing.columnsPerRow} cols`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return result;
}
