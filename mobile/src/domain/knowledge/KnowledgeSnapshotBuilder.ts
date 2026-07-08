import type { KnowledgeAggregation, SubjectAggregate } from './query';
import type {
  KnowledgeSnapshot, LearningHealth, SubjectKnowledge,
  MemoryLevel, MemoryState, ForgettingRisk, SnapshotAge, SnapshotMetadata,
} from './types';

function toMemoryLevel(retrievability: number): MemoryLevel {
  if (retrievability >= 85) return 'excellent';
  if (retrievability >= 70) return 'good';
  if (retrievability >= 50) return 'recovering';
  return 'critical';
}

function toMemoryState(retrievability: number, avgStability: number, minStability: number): MemoryState {
  if (retrievability < 60) return 'decaying';
  if (avgStability <= 3 || minStability <= 3) return 'unstable';
  return 'stable';
}

function toForgettingRisk(retrievability: number): ForgettingRisk {
  if (retrievability >= 80) return 'low';
  if (retrievability >= 60) return 'medium';
  return 'high';
}

function toSnapshotAge(ageMs: number): SnapshotAge {
  if (ageMs < 60 * 1000) return 'fresh';
  if (ageMs < 15 * 60 * 1000) return 'recent';
  if (ageMs < 60 * 60 * 1000) return 'stale';
  return 'expired';
}

function computeConfidence(totalCards: number): number {
  if (totalCards < 20) return 0.3;
  if (totalCards < 100) return 0.6;
  if (totalCards < 500) return 0.85;
  return 0.96;
}

export class KnowledgeSnapshotBuilder {
  private aggregation: KnowledgeAggregation;
  private generatedAt: Date;

  constructor(aggregation: KnowledgeAggregation) {
    this.aggregation = aggregation;
    this.generatedAt = new Date();
  }

  setClock(clock: Date): this {
    this.generatedAt = clock;
    return this;
  }

  build(): KnowledgeSnapshot {
    const aggregation = this.aggregation;
    const now = this.generatedAt;

    // ── Subjects ──────────────────────────────────────────────
    const subjects: SubjectKnowledge[] = aggregation.subjects.map(s => {
      const retrievability = s.avgRetrievability;
      return {
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        retrievability,
        memoryLevel: toMemoryLevel(retrievability),
        memoryState: toMemoryState(retrievability, s.avgStability, s.minStability),
        totalCards: s.totalCards,
        dueCards: s.dueCards,
        masteredCards: s.masteredCards,
        learningCards: s.learningCards,
        daysSinceLastReview: s.daysSinceLastReview,
        forgettingProbability: Math.round((100 - retrievability) * 100) / 100,
        risk: toForgettingRisk(retrievability),
      };
    });

    // ── Health ────────────────────────────────────────────────
    const totalCards = aggregation.totalCards;
    const activeSubjects = subjects.filter(s => s.totalCards > 0);
    const avgRetrievability = activeSubjects.length > 0
      ? activeSubjects.reduce((sum, s) => sum + s.retrievability, 0) / activeSubjects.length
      : 0;
    const knowledgeAtRiskCards = subjects
      .flatMap(s => [s])
      .filter(s => s.retrievability < 70 && s.totalCards > 0)
      .reduce((sum, s) => sum + s.totalCards, 0);
    const knowledgeAtRisk = totalCards > 0
      ? Math.round((knowledgeAtRiskCards / totalCards) * 100)
      : 0;

    const health: LearningHealth = {
      overallKnowledge: Math.round(avgRetrievability * 100) / 100,
      memoryLevel: toMemoryLevel(avgRetrievability),
      score: Math.round(avgRetrievability * 100) / 100,
      confidence: computeConfidence(totalCards),
      forgettingRisk: toForgettingRisk(avgRetrievability),
      knowledgeAtRisk,
    };

    // ── Metadata ──────────────────────────────────────────────
    const validUntil = new Date(now.getTime() + 15 * 60 * 1000);
    const ageMs = Date.now() - now.getTime();

    const metadata: SnapshotMetadata = {
      totalCards,
      totalDecks: aggregation.totalDecks,
      totalSubjects: aggregation.totalSubjects,
      daysSinceLastReview: aggregation.daysSinceLastReview,
    };

    const snapshot: KnowledgeSnapshot = Object.freeze({
      generatedAt: now,
      validUntil,
      age: toSnapshotAge(ageMs),
      clock: now.getTime(),
      health,
      subjects: Object.freeze(subjects),
      metadata,
    });

    return snapshot;
  }
}
