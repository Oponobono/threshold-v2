export type MemoryLevel = 'excellent' | 'good' | 'recovering' | 'critical';
export type MemoryState = 'stable' | 'unstable' | 'decaying' | 'fragile';
export type ForgettingRisk = 'low' | 'medium' | 'high';
export type Momentum = 'improving' | 'stable' | 'declining';
export type SnapshotAge = 'fresh' | 'recent' | 'stale' | 'expired';
export type KnowledgeMaturity = 'inicio' | 'consolidacion' | 'consolidado';

export interface LearningHealth {
  readonly overallKnowledge: number;
  readonly memoryLevel: MemoryLevel;
  readonly score: number;
  readonly confidence: number;
  readonly forgettingRisk: ForgettingRisk;
  readonly knowledgeAtRisk: number;
}

export interface SubjectKnowledge {
  readonly subjectId: string;
  readonly subjectName: string;
  readonly retrievability: number;
  readonly memoryLevel: MemoryLevel;
  readonly memoryState: MemoryState;
  readonly totalCards: number;
  readonly dueCards: number;
  readonly masteredCards: number;
  readonly learningCards: number;
  readonly daysSinceLastReview: number;
  readonly forgettingProbability: number;
  readonly risk: ForgettingRisk;
}

export interface SnapshotMetadata {
  readonly totalCards: number;
  readonly totalDecks: number;
  readonly totalSubjects: number;
  readonly daysSinceLastReview: number;
}

export interface KnowledgeSnapshot {
  readonly generatedAt: Date;
  readonly validUntil: Date;
  readonly age: SnapshotAge;
  readonly clock: number;
  readonly health: LearningHealth;
  readonly subjects: readonly SubjectKnowledge[];
  readonly metadata: SnapshotMetadata;
}
