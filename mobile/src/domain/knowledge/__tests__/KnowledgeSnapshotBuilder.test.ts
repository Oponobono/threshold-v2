import { KnowledgeSnapshotBuilder } from '../KnowledgeSnapshotBuilder';
import type { KnowledgeAggregation, SubjectAggregate } from '../query';

function makeSubject(overrides: Partial<SubjectAggregate> & { subjectId: string }): SubjectAggregate {
  return {
    subjectName: 'Test',
    totalCards: 10,
    dueCards: 3,
    masteredCards: 2,
    learningCards: 1,
    newCards: 7,
    avgRetrievability: 80,
    avgStability: 10,
    avgDifficulty: 3,
    maxStability: 20,
    minStability: 1,
    matureCards: 2,
    daysSinceLastReview: 0,
    ...overrides,
  };
}

function makeAggregation(subjects: SubjectAggregate[]): KnowledgeAggregation {
  const totalCards = subjects.reduce((s, c) => s + c.totalCards, 0);
  return {
    subjects,
    totalCards,
    totalDecks: 5,
    totalSubjects: subjects.length,
    daysSinceLastReview: subjects.reduce((min, s) => Math.min(min, s.daysSinceLastReview), 999),
    now: new Date('2026-07-06T12:00:00Z'),
  };
}

describe('KnowledgeSnapshotBuilder — Health', () => {
  test('health.score is the average of subject retrievabilities', () => {
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', avgRetrievability: 90 }),
      makeSubject({ subjectId: 's2', avgRetrievability: 70 }),
    ]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.health.score).toBe(80);
    expect(snapshot.health.overallKnowledge).toBe(80);
  });

  test('health.memoryLevel maps correctly from retrievability', () => {
    const excellent = new KnowledgeSnapshotBuilder(
      makeAggregation([makeSubject({ subjectId: 's1', avgRetrievability: 90 })])
    ).build();
    expect(excellent.health.memoryLevel).toBe('excellent');

    const good = new KnowledgeSnapshotBuilder(
      makeAggregation([makeSubject({ subjectId: 's1', avgRetrievability: 75 })])
    ).build();
    expect(good.health.memoryLevel).toBe('good');

    const recovering = new KnowledgeSnapshotBuilder(
      makeAggregation([makeSubject({ subjectId: 's1', avgRetrievability: 60 })])
    ).build();
    expect(recovering.health.memoryLevel).toBe('recovering');

    const critical = new KnowledgeSnapshotBuilder(
      makeAggregation([makeSubject({ subjectId: 's1', avgRetrievability: 30 })])
    ).build();
    expect(critical.health.memoryLevel).toBe('critical');
  });

  test('health.forgettingRisk in each level', () => {
    const low = new KnowledgeSnapshotBuilder(
      makeAggregation([makeSubject({ subjectId: 's1', avgRetrievability: 85 })])
    ).build();
    expect(low.health.forgettingRisk).toBe('low');

    const medium = new KnowledgeSnapshotBuilder(
      makeAggregation([makeSubject({ subjectId: 's1', avgRetrievability: 70 })])
    ).build();
    expect(medium.health.forgettingRisk).toBe('medium');

    const high = new KnowledgeSnapshotBuilder(
      makeAggregation([makeSubject({ subjectId: 's1', avgRetrievability: 50 })])
    ).build();
    expect(high.health.forgettingRisk).toBe('high');
  });
});

describe('KnowledgeSnapshotBuilder — Confidence', () => {
  test('confidence = 0.3 for < 20 cards', () => {
    const agg = makeAggregation([makeSubject({ subjectId: 's1', totalCards: 10 })]);
    agg.totalCards = 10;
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.health.confidence).toBe(0.3);
  });

  test('confidence = 0.6 for < 100 cards', () => {
    const agg = makeAggregation([makeSubject({ subjectId: 's1', totalCards: 50 })]);
    agg.totalCards = 50;
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.health.confidence).toBe(0.6);
  });

  test('confidence = 0.85 for < 500 cards', () => {
    const agg = makeAggregation([makeSubject({ subjectId: 's1', totalCards: 200 })]);
    agg.totalCards = 200;
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.health.confidence).toBe(0.85);
  });

  test('confidence = 0.96 for >= 500 cards', () => {
    const agg = makeAggregation([makeSubject({ subjectId: 's1', totalCards: 500 })]);
    agg.totalCards = 500;
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.health.confidence).toBe(0.96);
  });
});

describe('KnowledgeSnapshotBuilder — Subjects', () => {
  test('subjectMemoryLevel maps correctly', () => {
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', avgRetrievability: 90 }),
      makeSubject({ subjectId: 's2', avgRetrievability: 60 }),
      makeSubject({ subjectId: 's3', avgRetrievability: 40 }),
    ]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.subjects[0].memoryLevel).toBe('excellent');
    expect(snapshot.subjects[1].memoryLevel).toBe('recovering');
    expect(snapshot.subjects[2].memoryLevel).toBe('critical');
  });

  test('subjectMemoryState from stability', () => {
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', avgStability: 30, minStability: 10, avgRetrievability: 80 }),
      makeSubject({ subjectId: 's2', avgStability: 1, minStability: 0.5, avgRetrievability: 80 }),
    ]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.subjects[0].memoryState).toBe('stable');
    expect(snapshot.subjects[1].memoryState).toBe('unstable');
  });

  test('subjectMemoryState decaying when retrievability < 60', () => {
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', avgRetrievability: 50, avgStability: 30 }),
    ]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.subjects[0].memoryState).toBe('decaying');
  });

  test('subjectForgettingRisk', () => {
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', avgRetrievability: 85 }),
      makeSubject({ subjectId: 's2', avgRetrievability: 70 }),
      makeSubject({ subjectId: 's3', avgRetrievability: 50 }),
    ]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.subjects[0].risk).toBe('low');
    expect(snapshot.subjects[1].risk).toBe('medium');
    expect(snapshot.subjects[2].risk).toBe('high');
  });
});

describe('KnowledgeSnapshotBuilder — Metadata', () => {
  test('snapshot age is fresh when built', () => {
    const agg = makeAggregation([makeSubject({ subjectId: 's1' })]);
    // The age check compares (Date.now() - now.getTime()). Since we pass clock directly
    // and Date.now() runs at test time, the age will be near-zero = 'fresh'
    const snapshot = new KnowledgeSnapshotBuilder(agg).setClock(new Date()).build();
    expect(snapshot.age).toBe('fresh');
  });

  test('snapshot age is recent for old clock', () => {
    const agg = makeAggregation([makeSubject({ subjectId: 's1' })]);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const snapshot = new KnowledgeSnapshotBuilder(agg).setClock(fiveMinAgo).build();
    expect(snapshot.age).toBe('recent');
  });

  test('validUntil is 15 min after generatedAt', () => {
    const clock = new Date('2026-07-06T12:00:00Z');
    const agg = makeAggregation([makeSubject({ subjectId: 's1' })]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).setClock(clock).build();
    expect(snapshot.validUntil.getTime()).toBe(clock.getTime() + 15 * 60 * 1000);
  });

  test('metadata fields match aggregation', () => {
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', totalCards: 10 }),
      makeSubject({ subjectId: 's2', totalCards: 20 }),
    ]);
    agg.totalCards = 30;
    agg.totalDecks = 8;
    agg.totalSubjects = 2;
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.metadata.totalCards).toBe(30);
    expect(snapshot.metadata.totalDecks).toBe(8);
    expect(snapshot.metadata.totalSubjects).toBe(2);
  });
});

describe('KnowledgeSnapshotBuilder — Determinism', () => {
  test('same data + same clock = same snapshot', () => {
    const clock = new Date('2026-07-06T12:00:00Z');
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', avgRetrievability: 85, totalCards: 15 }),
      makeSubject({ subjectId: 's2', avgRetrievability: 65, totalCards: 10 }),
    ]);

    // Fix Date.now() for the snapshot age calculation inside build()
    const originalNow = Date.now;
    Date.now = jest.fn(() => clock.getTime());

    const a = new KnowledgeSnapshotBuilder(agg).setClock(clock).build();
    const b = new KnowledgeSnapshotBuilder(agg).setClock(clock).build();

    Date.now = originalNow;

    expect(a.clock).toBe(b.clock);
    expect(a.health.score).toBe(b.health.score);
    expect(a.health.memoryLevel).toBe(b.health.memoryLevel);
    expect(a.subjects[0].retrievability).toBe(b.subjects[0].retrievability);
    expect(a.subjects[1].memoryState).toBe(b.subjects[1].memoryState);
    expect(a.health.confidence).toBe(b.health.confidence);
  });
});

describe('KnowledgeSnapshotBuilder — Edge cases', () => {
  test('subjects with no cards are handled', () => {
    const agg = makeAggregation([
      makeSubject({ subjectId: 's1', totalCards: 10, avgRetrievability: 80 }),
      makeSubject({ subjectId: 's2', totalCards: 0, avgRetrievability: 0 }),
    ]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.subjects).toHaveLength(2);
    expect(snapshot.subjects[1].totalCards).toBe(0);
    expect(snapshot.health.score).toBe(80); // only s1 counts
  });

  test('empty aggregation produces zero health', () => {
    const agg = makeAggregation([]);
    agg.totalCards = 0;
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(snapshot.health.score).toBe(0);
    expect(snapshot.health.memoryLevel).toBe('critical');
    expect(snapshot.metadata.totalCards).toBe(0);
  });

  test('snapshot is frozen', () => {
    const agg = makeAggregation([makeSubject({ subjectId: 's1' })]);
    const snapshot = new KnowledgeSnapshotBuilder(agg).build();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.subjects)).toBe(true);
  });
});
