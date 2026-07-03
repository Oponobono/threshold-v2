import { deleteSubject } from '../SubjectDomainService';
import { repositoryEventBus } from '../../events/RepositoryEventBus';

jest.mock('../../events/RepositoryEventBus', () => ({
  repositoryEventBus: { emit: jest.fn() },
}));

// ─── In-memory SQL mock ───────────────────────────────────────────────────────

type Row = Record<string, any>;
const tables = new Map<string, Map<string, Row>>();

function ensure(name: string) {
  if (!tables.has(name)) tables.set(name, new Map());
  return tables.get(name)!;
}

function clearTables() { tables.clear(); }

function prependTableAndEval(sql: string, rows: Row[], params: any[]): Row[] {
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$|\))/i);
  if (!whereMatch) return rows;
  const clause = whereMatch[1];

  const parts = clause.split(/\s+AND\s+/i);
  for (const part of parts) {
    const inMatch = part.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const field = inMatch[1];
      const pl = inMatch[2].split(',').map(p => p.trim());
      const values = pl.map(p => (p === '?' ? params[0] : p.replace(/^'|'$/g, '')));
      rows = rows.filter(r => values.includes(r[field]));
      continue;
    }
    const eqMatch = part.match(/(\w+)\s*=\s*\?/i);
    if (eqMatch) {
      const field = eqMatch[1];
      const before = clause.substring(0, clause.indexOf(eqMatch[0]));
      const paramIdx = (before.match(/\?/g) || []).length;
      rows = rows.filter(r => String(r[field]) === String(params[paramIdx]));
      continue;
    }
    const nullMatch = part.match(/(\w+)\s+IS\s+(NOT\s+)?NULL/i);
    if (nullMatch) {
      const field = nullMatch[1];
      const isNot = !!nullMatch[2];
      rows = rows.filter(r => (isNot ? r[field] != null : r[field] == null));
    }
  }
  return rows;
}

const db: any = {};

db.getAllAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const m = sql.match(/FROM\s+(\w+)/i);
  if (!m) return [];
  return prependTableAndEval(sql, Array.from(ensure(m[1]).values()), params);
});

db.runAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const m = sql.match(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i);
  if (!m) return {};
  const tableName = m[1];
  const table = ensure(tableName);

  const delMatch = sql.match(/DELETE\s+FROM\s+\w+/i);
  if (delMatch) {
    const rows = prependTableAndEval(sql, Array.from(table.values()), params);
    for (const row of rows) table.delete(row.id);
    return {};
  }

  const updMatch = sql.match(/UPDATE\s+\w+\s+SET\s+(.+?)\s+WHERE/i);
  if (updMatch) {
    const pairs = updMatch[1].split(',').map(s => {
      const eq = s.indexOf('=');
      return { k: s.substring(0, eq).trim(), v: s.substring(eq + 1).trim() };
    });
    const remaining = sql.substring(sql.indexOf('WHERE'));
    const targets = prependTableAndEval(
      remaining, Array.from(table.values()), params,
    );
    for (const target of targets) {
      let pi = 0;
      for (const { k, v } of pairs) {
        if (v === '?') { target[k] = params[pi++]; }
        else if (v.includes('datetime')) { target[k] = '2026-07-02T12:00:00.000Z'; }
      }
      table.set(target.id, target);
    }
    return {};
  }

  return {};
});

db.execAsync = jest.fn(async () => {});
db.closeAsync = jest.fn(async () => {});
db.withExclusiveTransactionAsync = jest.fn(async (cb: any) => cb(db));

jest.mock('../../database/DatabaseService', () => {
  class MockDatabaseService {
    async open() { return db; }
    getDb() { return db; }
    async close() {}
  }
  return { databaseService: new MockDatabaseService(), DatabaseService: MockDatabaseService };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS = '2026-07-02T12:00:00.000Z';

function seedRow(table: string, overrides: Record<string, any> = {}) {
  const row: Row = {
    id: `${table}_1`, user_id: 'u1', subject_id: 'subject_1',
    deleted_at: null, created_at: TS, updated_at: TS, version_number: 1,
    ...overrides,
  };
  if (table === 'flashcards') row.deck_id = overrides.deck_id || 'deck_1';
  ensure(table).set(row.id, row);
}

function seedJournal(entityType: string, entityId: string) {
  ensure('sync_queue').set(`j_${entityType}_${entityId}`, {
    id: `j_${entityType}_${entityId}`, entity_type: entityType,
    entity_id: entityId, operation: 'UPDATE', status: 'pending',
    created_at: TS, user_id: 'u1',
  });
}

function seedFullSubject() {
  seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
  seedRow('assessments', { id: 'assess_1' });
  seedRow('assessment_categories', { id: 'cat_1' });
  seedRow('schedules', { id: 'sched_1' });
  seedRow('study_sessions', { id: 'ss_1' });
  seedRow('threshold_overrides', { id: 'to_1' });
  seedRow('photos', { id: 'photo_1' });
  seedRow('audio_recordings', { id: 'audio_1' });
  seedRow('scanned_documents', { id: 'doc_1' });
  seedRow('youtube_videos', { id: 'yt_1' });
  seedRow('flashcard_decks', { id: 'deck_1' });
  seedRow('flashcards', { id: 'card_1', deck_id: 'deck_1' });
  seedRow('calendar_events', { id: 'cal_1' });
}

const emitMock = () => repositoryEventBus.emit as jest.Mock;

beforeEach(() => {
  clearTables();
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SubjectDomainService.deleteSubject', () => {
  test('soft-deletes all 11 child entity types', async () => {
    seedFullSubject();
    await deleteSubject('subject_1', 'u1');

    for (const table of ['assessments','assessment_categories','schedules',
      'study_sessions','threshold_overrides','photos','audio_recordings',
      'scanned_documents','youtube_videos','flashcard_decks','calendar_events',
    ]) {
      const rows = Array.from(ensure(table).values());
      expect(rows).toHaveLength(1);
      expect(rows[0].deleted_at).not.toBeNull();
    }
  });

  test('cascade soft-deletes flashcards inside decks', async () => {
    seedFullSubject();
    await deleteSubject('subject_1', 'u1');

    const cards = Array.from(ensure('flashcards').values());
    expect(cards).toHaveLength(1);
    expect(cards[0].deleted_at).not.toBeNull();
  });

  test('soft-deletes the subject itself', async () => {
    seedFullSubject();
    await deleteSubject('subject_1', 'u1');

    const subjects = Array.from(ensure('subjects').values());
    expect(subjects).toHaveLength(1);
    expect(subjects[0].deleted_at).not.toBeNull();
  });

  test('removes journal entries for all affected entities', async () => {
    seedFullSubject();
    seedJournal('subject', 'subject_1');
    seedJournal('assessment', 'assess_1');
    seedJournal('flashcard-deck', 'deck_1');
    seedJournal('flashcard', 'card_1');
    seedJournal('photo', 'photo_1');

    await deleteSubject('subject_1', 'u1');

    expect(ensure('sync_queue').size).toBe(0);
  });

  test('retains journal entries for unrelated entities', async () => {
    seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
    seedJournal('subject', 'subject_1');
    seedJournal('flashcard', 'card_unrelated');

    await deleteSubject('subject_1', 'u1');

    expect(ensure('sync_queue').size).toBe(1);
    expect(Array.from(ensure('sync_queue').values())[0].entity_id).toBe('card_unrelated');
  });

  test('emits deleted event for subject', async () => {
    seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
    await deleteSubject('subject_1', 'u1');

    const calls = emitMock().mock.calls.map((c: any[]) => c[0].entityType);
    expect(calls).toContain('subjects');
  });

  test('emits deleted event with plural eventType for child types', async () => {
    seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
    seedRow('assessments', { id: 'assess_1' });
    seedRow('schedules', { id: 'sched_1' });

    await deleteSubject('subject_1', 'u1');

    const types = emitMock().mock.calls.map((c: any[]) => c[0].entityType);
    expect(types).toContain('assessments');
    expect(types).toContain('schedules');
  });

  test('handles subject with no children', async () => {
    seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
    await deleteSubject('subject_1', 'u1');
    const subjects = Array.from(ensure('subjects').values());
    expect(subjects[0].deleted_at).not.toBeNull();
  });

  test('handles subject with partial children', async () => {
    seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
    seedRow('assessments', { id: 'assess_1' });
    seedRow('flashcard_decks', { id: 'deck_1' });

    await deleteSubject('subject_1', 'u1');

    expect(Array.from(ensure('assessments').values())[0].deleted_at).not.toBeNull();
    expect(Array.from(ensure('flashcard_decks').values())[0].deleted_at).not.toBeNull();
    expect(ensure('calendar_events').size).toBe(0);
  });

  test('does not enqueue DELETE (caller handles sync)', async () => {
    seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
    await deleteSubject('subject_1', 'u1');

    const ops = Array.from(ensure('sync_queue').values());
    expect(ops.filter(r => r.entity_type === 'subject')).toHaveLength(0);
  });

  test('children already soft-deleted remain soft-deleted (idempotent)', async () => {
    seedRow('subjects', { id: 'subject_1', user_id: 'u1' });
    seedRow('assessments', { id: 'assess_1', deleted_at: '2026-01-01T00:00:00.000Z' });

    await deleteSubject('subject_1', 'u1');

    const rows = Array.from(ensure('assessments').values());
    expect(rows[0].deleted_at).toBe('2026-01-01T00:00:00.000Z');
  });
});
