import { snapshotToRadarData } from '../masteryRadarAdapter';
import type { KnowledgeSnapshot, SubjectKnowledge } from '../types';

function makeSubject(overrides: Partial<SubjectKnowledge>): SubjectKnowledge {
  return {
    subjectId: 's1',
    subjectName: 'Math',
    retrievability: 75,
    memoryLevel: 'good',
    memoryState: 'stable',
    totalCards: 20,
    dueCards: 5,
    masteredCards: 10,
    learningCards: 5,
    daysSinceLastReview: 2,
    forgettingProbability: 25,
    risk: 'medium',
    ...overrides,
  };
}

function makeSnapshot(subjects: SubjectKnowledge[]): KnowledgeSnapshot {
  return {
    generatedAt: new Date(),
    validUntil: new Date(Date.now() + 900000),
    age: 'fresh',
    clock: Date.now(),
    health: {
      overallKnowledge: 75,
      memoryLevel: 'good',
      score: 75,
      confidence: 0.85,
      forgettingRisk: 'medium',
      knowledgeAtRisk: 10,
    },
    subjects,
    metadata: {
      totalCards: subjects.reduce((s, sub) => s + sub.totalCards, 0),
      totalDecks: 1,
      totalSubjects: subjects.length,
      daysSinceLastReview: 2,
    },
  };
}

describe('masteryRadarAdapter', () => {

  describe('INVARIANT M1: retrievability is FSRS-derived state, not card_logs', () => {
    it('retrievability 0-100 contract preserved in radar output', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Algebra', retrievability: 92, totalCards: 50 }),
        makeSubject({ subjectId: 's2', subjectName: 'History', retrievability: 45, totalCards: 30 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar[0].value).toBe(92);
      expect(result.radar[1].value).toBe(45);
    });

    it('new card (low stability, recent) vs mature card (high stability, old)', () => {
      const snapshot = makeSnapshot([
        makeSubject({
          subjectId: 's1', subjectName: 'New Subject',
          retrievability: 8, totalCards: 5, dueCards: 5,
          masteredCards: 0, learningCards: 5, daysSinceLastReview: 0,
        }),
        makeSubject({
          subjectId: 's2', subjectName: 'Mature Subject',
          retrievability: 95, totalCards: 200, dueCards: 10,
          masteredCards: 180, learningCards: 10, daysSinceLastReview: 1,
        }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar[0].value).toBe(8);
      expect(result.radar[1].value).toBe(95);
      expect(result.averageMastery).toBe(52); // round((8+95)/2)
    });

    it('retrievability is percentage, not 0-1 fraction', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Test', retrievability: 73, totalCards: 10 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      // If retrievability were 0-1, Math.round(0.73) = 1 (BUG)
      // Since it's 0-100, Math.round(73) = 73 (CORRECT)
      expect(result.radar[0].value).toBe(73);
      expect(result.radar[0].value).toBeGreaterThan(50);
    });
  });

  describe('INVARIANT M2: card_logs does not influence output', () => {
    it('adapter only reads from KnowledgeSnapshot, not from analytics API', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Physics', retrievability: 68, totalCards: 40 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar).toHaveLength(1);
      expect(result.radar[0].name).toBe('Physics');
      expect(result.radar[0].value).toBe(68);
    });
  });

  describe('subjects without flashcards excluded', () => {
    it('filters out totalCards = 0', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Math', retrievability: 80, totalCards: 30 }),
        makeSubject({ subjectId: 's2', subjectName: 'Empty', retrievability: 0, totalCards: 0 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar).toHaveLength(1);
      expect(result.radar[0].name).toBe('Math');
    });

    it('all subjects empty → empty radar', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'A', totalCards: 0 }),
        makeSubject({ subjectId: 's2', subjectName: 'B', totalCards: 0 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar).toHaveLength(0);
      expect(result.averageMastery).toBe(0);
      expect(result.strongestArea).toBeNull();
      expect(result.weakestArea).toBeNull();
    });
  });

  describe('global average is unweighted mean of subjects', () => {
    it('does not weight by card count', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Big', retrievability: 90, totalCards: 1000 }),
        makeSubject({ subjectId: 's2', subjectName: 'Small', retrievability: 50, totalCards: 2 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      // Unweighted: (90 + 50) / 2 = 70
      // Weighted would be: (90*1000 + 50*2) / 1002 ≈ 89.9
      expect(result.averageMastery).toBe(70);
    });
  });

  describe('color mapping', () => {
    it('correct colors for each threshold', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'A', retrievability: 95, totalCards: 10 }),
        makeSubject({ subjectId: 's2', subjectName: 'B', retrievability: 70, totalCards: 10 }),
        makeSubject({ subjectId: 's3', subjectName: 'C', retrievability: 50, totalCards: 10 }),
        makeSubject({ subjectId: 's4', subjectName: 'D', retrievability: 30, totalCards: 10 }),
        makeSubject({ subjectId: 's5', subjectName: 'E', retrievability: 10, totalCards: 10 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar[0].color).toBe('#10B981'); // >= 80 green
      expect(result.radar[1].color).toBe('#3B82F6'); // >= 60 blue
      expect(result.radar[2].color).toBe('#F97316'); // >= 40 orange
      expect(result.radar[3].color).toBe('#EF4444'); // >= 20 red
      expect(result.radar[4].color).toBe('#7C3AED'); // < 20 purple
    });
  });

  describe('single subject filtering', () => {
    it('filters by subjectId when not "all"', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Math', retrievability: 80, totalCards: 20 }),
        makeSubject({ subjectId: 's2', subjectName: 'History', retrievability: 60, totalCards: 15 }),
      ]);
      const result = snapshotToRadarData(snapshot, 's1');
      expect(result.radar).toHaveLength(1);
      expect(result.radar[0].name).toBe('Math');
    });
  });

  describe('edge cases', () => {
    it('retrievability 0% → value 0, color purple', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Forgot', retrievability: 0, totalCards: 10 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar[0].value).toBe(0);
      expect(result.radar[0].color).toBe('#7C3AED');
    });

    it('retrievability 100% → value 100, color green', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: 'Perfect', retrievability: 100, totalCards: 10 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar[0].value).toBe(100);
      expect(result.radar[0].color).toBe('#10B981');
    });

    it('subjectName fallback to "General"', () => {
      const snapshot = makeSnapshot([
        makeSubject({ subjectId: 's1', subjectName: '', retrievability: 70, totalCards: 10 }),
      ]);
      const result = snapshotToRadarData(snapshot, 'all');
      expect(result.radar[0].name).toBe('General');
    });
  });
});
