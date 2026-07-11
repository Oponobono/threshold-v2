import { ReminderSnapshotBuilder } from '../ReminderSnapshotBuilder';

function mockGetAll<T>(data: T[]): () => Promise<T[]> {
  return async () => data;
}

describe('ReminderSnapshotBuilder', () => {
  it('build returns all 5 entity types when repos have data', async () => {
    const builder = new ReminderSnapshotBuilder({
      assessments: { getAll: mockGetAll<any>([{ id: 'a1', subject_id: 's1', name: 'Examen', date: '2026-07-15' }]) },
      schedules: { getAll: mockGetAll<any>([{ id: 's1', user_id: 'u1', startTime: '09:00', endTime: '10:00' }]) },
      flashcard_decks: { getAll: mockGetAll<any>([{ id: 'd1', user_id: 'u1', title: 'Matemáticas', card_count: 20 }]) },
      grading_periods: { getAll: mockGetAll<any>([{ id: 'g1', user_id: 'u1', name: 'Q1', period_type: 'quarter', closeDate: '2026-08-01' }]) },
      calendar_events: { getAll: mockGetAll<any>([{ id: 'e1', user_id: 'u1', title: 'Reunión', endDate: '2026-07-10' }]) },
    });
    const snapshot = await builder.build();
    expect(snapshot.assessments).toHaveLength(1);
    expect(snapshot.schedules).toHaveLength(1);
    expect(snapshot.flashcard_decks).toHaveLength(1);
    expect(snapshot.grading_periods).toHaveLength(1);
    expect(snapshot.calendar_events).toHaveLength(1);
  });

  it('build returns correct entity data', async () => {
    const builder = new ReminderSnapshotBuilder({
      assessments: { getAll: mockGetAll<any>([{ id: 'a1', subject_id: 's1', name: 'Examen' }]) },
      schedules: { getAll: mockGetAll<any>([]) },
      flashcard_decks: { getAll: mockGetAll<any>([]) },
      grading_periods: { getAll: mockGetAll<any>([]) },
      calendar_events: { getAll: mockGetAll<any>([]) },
    });
    const snapshot = await builder.build();
    expect(snapshot.assessments![0]).toEqual({ id: 'a1', subject_id: 's1', name: 'Examen' });
  });

  it('build returns empty arrays when repos are empty', async () => {
    const builder = new ReminderSnapshotBuilder({
      assessments: { getAll: mockGetAll<any>([]) },
      schedules: { getAll: mockGetAll<any>([]) },
      flashcard_decks: { getAll: mockGetAll<any>([]) },
      grading_periods: { getAll: mockGetAll<any>([]) },
      calendar_events: { getAll: mockGetAll<any>([]) },
    });
    const snapshot = await builder.build();
    expect(snapshot.assessments).toEqual([]);
    expect(snapshot.schedules).toEqual([]);
    expect(snapshot.flashcard_decks).toEqual([]);
    expect(snapshot.grading_periods).toEqual([]);
    expect(snapshot.calendar_events).toEqual([]);
  });

  it('build is deterministic (same repos produce same snapshot)', async () => {
    const repos = {
      assessments: { getAll: mockGetAll<any>([{ id: 'a1', subject_id: 's1', name: 'A' }, { id: 'a2', subject_id: 's1', name: 'B' }]) },
      schedules: { getAll: mockGetAll<any>([]) },
      flashcard_decks: { getAll: mockGetAll<any>([{ id: 'd1', user_id: 'u1', title: 'D' }]) },
      grading_periods: { getAll: mockGetAll<any>([]) },
      calendar_events: { getAll: mockGetAll<any>([]) },
    };
    const builder = new ReminderSnapshotBuilder(repos);
    const snapshot1 = await builder.build();
    const snapshot2 = await builder.build();
    expect(snapshot1).toEqual(snapshot2);
  });

  it('build handles partial data (some repos have data, others empty)', async () => {
    const builder = new ReminderSnapshotBuilder({
      assessments: { getAll: mockGetAll<any>([{ id: 'a1', subject_id: 's1', name: 'A' }]) },
      schedules: { getAll: mockGetAll<any>([]) },
      flashcard_decks: { getAll: mockGetAll<any>([]) },
      grading_periods: { getAll: mockGetAll<any>([{ id: 'g1', user_id: 'u1', name: 'G', period_type: 'quarter' }]) },
      calendar_events: { getAll: mockGetAll<any>([]) },
    });
    const snapshot = await builder.build();
    expect(snapshot.assessments).toHaveLength(1);
    expect(snapshot.grading_periods).toHaveLength(1);
    expect(snapshot.schedules).toHaveLength(0);
    expect(snapshot.flashcard_decks).toHaveLength(0);
    expect(snapshot.calendar_events).toHaveLength(0);
  });

  it('build does not modify the original entity references', async () => {
    const original = [{ id: 'a1', subject_id: 's1', name: 'Examen' }];
    const builder = new ReminderSnapshotBuilder({
      assessments: { getAll: mockGetAll<any>(original) },
      schedules: { getAll: mockGetAll<any>([]) },
      flashcard_decks: { getAll: mockGetAll<any>([]) },
      grading_periods: { getAll: mockGetAll<any>([]) },
      calendar_events: { getAll: mockGetAll<any>([]) },
    });
    const snapshot = await builder.build();
    expect(snapshot.assessments![0]).toBe(original[0]);
  });
});
