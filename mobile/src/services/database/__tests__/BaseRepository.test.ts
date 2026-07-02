import { BaseRepository } from '../BaseRepository';

interface TestEntity {
  id: string;
  name: string;
  user_id: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  version_number?: number;
}

const mockTables = new Map<string, Map<string, any>>();

function ensureTable(name: string) {
  if (!mockTables.has(name)) mockTables.set(name, new Map());
  return mockTables.get(name)!;
}

function evalWhere(sql: string, rows: any[], params: any[]) {
  const m = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$|\))/i);
  if (!m) return rows;
  const clause = m[1];

  const idMatch = clause.match(/id\s*=\s*\?/);
  if (idMatch) {
    const before = clause.substring(0, idMatch.index!);
    const paramIdx = (before.match(/\?/g) || []).length;
    rows = rows.filter((r: any) => r.id === params[paramIdx]);
  }

  if (/deleted_at\s+IS\s+NULL/i.test(clause))
    rows = rows.filter((r: any) => r.deleted_at == null);
  if (/deleted_at\s+IS\s+NOT\s+NULL/i.test(clause))
    rows = rows.filter((r: any) => r.deleted_at != null);
  if (/user_id\s*=\s*\?/i.test(clause)) {
    const uIdx = clause.indexOf('user_id');
    const paramUIdx = (clause.substring(0, uIdx).match(/\?/g) || []).length;
    rows = rows.filter((r: any) => String(r.user_id) === String(params[paramUIdx]));
  }

  return rows;
}

const db: any = {};

db.getAllAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const from = sql.match(/FROM\s+(\w+)/i);
  if (!from) return [];
  return evalWhere(sql, Array.from(ensureTable(from[1]).values()), params || []);
});

db.getFirstAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const isCount = /COUNT\s*\(\s*\*\s*\)/i.test(sql);
  const rows = await db.getAllAsync(sql, ...(params || []));
  if (isCount) return { count: rows.length };
  return rows[0] || null;
});

db.runAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const insert = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  if (insert) {
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (colMatch) {
      const cols = colMatch[1].split(',').map((c: string) => c.trim());
      const obj: any = {};
      cols.forEach((col: string, i: number) => { obj[col] = params[i]; });
      ensureTable(insert[1]).set(obj.id, obj);
    }
    return {};
  }

  const update = sql.match(/UPDATE\s+(\w+)/i);
  if (update) {
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    if (setMatch) {
      const pairs = setMatch[1].split(',').map((s: string) => {
        const eq = s.indexOf('=');
        return { k: s.substring(0, eq).trim(), v: s.substring(eq + 1).trim() };
      });
      const id = params[params.length - 1];
      let existing = ensureTable(update[1]).get(id);
      if (!existing) { existing = {}; ensureTable(update[1]).set(id, existing); }
      pairs.forEach(({ k, v }: { k: string; v: string }) => {
        const pi = pairs.findIndex((p: any) => p.k === k);
        existing[k] = v === '?' ? params[pi]
          : v.includes('datetime') ? new Date().toISOString()
          : /^\d+$/.test(v) ? Number(v)
          : v.replace(/^'|'$/g, '');
      });
      ensureTable(update[1]).set(id, existing);
    }
    return {};
  }
});

db.execAsync = jest.fn(async () => {});
db.closeAsync = jest.fn(async () => {});
db.withExclusiveTransactionAsync = jest.fn(async (cb: any) => cb(db));

/** test hook: clear all in-memory tables between tests */
function clearMockTables() {
  mockTables.clear();
}

jest.mock('../DatabaseService', () => {
  class MockDatabaseService {
    async open(): Promise<any> { return db; }
    getDb(): any { return db; }
    async close(): Promise<void> {}
  }
  return { databaseService: new MockDatabaseService(), DatabaseService: MockDatabaseService };
});

describe('BaseRepository — Soft delete filtering contract', () => {
  let repo: BaseRepository<TestEntity>;

  beforeEach(() => {
    clearMockTables();
  });

  beforeAll(async () => {
    repo = new BaseRepository<TestEntity>('test_entities');
    jest.spyOn(repo as any, 'getValidColumns').mockResolvedValue(['id', 'name', 'user_id', 'deleted_at', 'created_at', 'updated_at', 'version_number']);
  });

  test('getAll() does not return soft-deleted records', async () => {
    const entity: TestEntity = { id: 'e1', name: 'Test', user_id: 'u1' };
    await repo.create(entity);
    let all = await repo.getAll();
    expect(all).toHaveLength(1);

    await repo.delete('e1');
    all = await repo.getAll();
    expect(all).toHaveLength(0);
  });

  test('getById() returns null for soft-deleted records', async () => {
    const entity: TestEntity = { id: 'e2', name: 'Test2', user_id: 'u1' };
    await repo.create(entity);

    let found = await repo.getById('e2');
    expect(found).not.toBeNull();

    await repo.delete('e2');
    found = await repo.getById('e2');
    expect(found).toBeNull();
  });

  test('getByIdIncludingDeleted() returns soft-deleted records', async () => {
    const entity: TestEntity = { id: 'e3', name: 'Test3', user_id: 'u1' };
    await repo.create(entity);
    await repo.delete('e3');

    const found = await repo.getByIdIncludingDeleted('e3');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('e3');
  });

  test('getByField() does not return soft-deleted records', async () => {
    const entity: TestEntity = { id: 'e4', name: 'Test4', user_id: 'u1' };
    await repo.create(entity);
    await repo.delete('e4');

    const results = await repo.getByField('user_id', 'u1');
    expect(results).toHaveLength(0);
  });

  test('count() excludes soft-deleted records', async () => {
    const e1: TestEntity = { id: 'c1', name: 'Count1', user_id: 'u1' };
    const e2: TestEntity = { id: 'c2', name: 'Count2', user_id: 'u1' };
    await repo.create(e1);
    await repo.create(e2);
    expect(await repo.count()).toBe(2);

    await repo.delete('c1');
    expect(await repo.count()).toBe(1);
  });

  test('requireActive() throws for soft-deleted records', async () => {
    const entity: TestEntity = { id: 'e5', name: 'Test5', user_id: 'u1' };
    await repo.create(entity);
    await repo.delete('e5');

    await expect(repo.requireActive('e5')).rejects.toThrow('has been deleted');
  });

  test('requireActive() throws for non-existent records', async () => {
    await expect(repo.requireActive('nonexistent')).rejects.toThrow('does not exist');
  });

  test('requireActive() throws for wrong user', async () => {
    const entity: TestEntity = { id: 'e6', name: 'Test6', user_id: 'u1' };
    await repo.create(entity);

    await expect(repo.requireActive('e6', 'u2')).rejects.toThrow('does not belong to user');
  });

  test('upsert() can update soft-deleted records via getByIdIncludingDeleted', async () => {
    const entity: TestEntity = { id: 'e7', name: 'Original', user_id: 'u1' };
    await repo.create(entity);
    await repo.delete('e7');

    const upsertData: TestEntity = { id: 'e7', name: 'Resurrected', user_id: 'u1', version_number: 2 };
    jest.spyOn(repo as any, 'getByIdIncludingDeleted');

    const conflictResolver = require('../../sync/ConflictResolver').conflictResolver;
    jest.spyOn(conflictResolver, 'resolve').mockReturnValue({
      winner: 'remote',
      data: upsertData,
      version_number: 2,
    });

    await repo.upsert(upsertData);

    const deleted = await repo.getByIdIncludingDeleted('e7');
    expect(deleted).not.toBeNull();
    expect(deleted!.name).toBe('Resurrected');
  });
});
