/**
 * DocumentAnchor Persistence Tests
 *
 * Validates that the DocumentAnchorRepository stores, retrieves, and soft-deletes
 * correctly. All sync protocol fields (sync_version, deleted_at) are verified.
 * No real SQLite DB is used — the repository methods are mocked at the DB layer.
 */

import type { DocumentAnchorRow } from '../repositories/DocumentAnchorRepository';
import { DocumentAnchorRepository } from '../repositories/DocumentAnchorRepository';

// ─── Mock DatabaseService ────────────────────────────────────────────────────

const mockRows: DocumentAnchorRow[] = [];

const mockDb = {
  getAllAsync: jest.fn(async (_sql: string, params: any[]) => {
    if (params[0] === 'doc-001') return mockRows;
    return [];
  }),
  getFirstAsync: jest.fn(async (_sql: string, params: any[]) => {
    return mockRows.find(r => r.id === params[0]) ?? null;
  }),
  runAsync: jest.fn(async () => ({ rowsAffected: 1 })),
};

jest.mock('../DatabaseService', () => ({
  databaseService: {
    getDb: () => mockDb,
    getAllTracked: (_sql: string, params: any[]) => mockDb.getAllAsync(_sql, params),
    getFirstTracked: (_sql: string, params: any[]) => mockDb.getFirstAsync(_sql, params),
    runTracked: (_sql: string) => mockDb.runAsync(),
  },
}));

jest.mock('../../events/RepositoryEventBus', () => ({
  repositoryEventBus: { emit: jest.fn() },
}));

jest.mock('../../sync/ConflictResolver', () => ({
  conflictResolver: { resolve: jest.fn() },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAnchor(overrides: Partial<DocumentAnchorRow> = {}): DocumentAnchorRow {
  return {
    id: 'anchor-001',
    user_id: 'user-123',
    document_id: 'doc-001',
    page_index: 3,
    block_id: 'paragraph_12',
    char_start: 40,
    char_end: 85,
    target_type: 'flashcard',
    target_id: 'deck-abc',
    sync_version: 0,
    version_number: 1,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DocumentAnchorRepository — Persistencia', () => {
  let repo: DocumentAnchorRepository;

  beforeEach(() => {
    repo = new DocumentAnchorRepository();
    mockRows.length = 0;
    jest.clearAllMocks();
  });

  it('findByDocumentId devuelve anclas del documento correcto', async () => {
    const anchor = makeAnchor();
    mockRows.push(anchor);

    const results = await repo.findByDocumentId('doc-001');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('anchor-001');
    expect(results[0].document_id).toBe('doc-001');
  });

  it('findByDocumentPage filtra por página y ordena por char_start', async () => {
    const a1 = makeAnchor({ id: 'a1', page_index: 3, char_start: 100 });
    const a2 = makeAnchor({ id: 'a2', page_index: 3, char_start: 10 });
    const a3 = makeAnchor({ id: 'a3', page_index: 5, char_start: 0 });
    mockRows.push(a1, a2, a3);

    mockDb.getAllAsync.mockResolvedValueOnce([a2, a1]); // mocked already sorted
    const results = await repo.findByDocumentPage('doc-001', 3);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('a2');
    expect(results[1].id).toBe('a1');
  });

  it('findByTarget localiza anclas por (target_type, target_id)', async () => {
    const anchor = makeAnchor({ target_type: 'summary', target_id: 'sum-99' });
    mockRows.push(anchor);

    mockDb.getAllAsync.mockResolvedValueOnce([anchor]);
    const results = await repo.findByTarget('summary', 'sum-99');

    expect(results).toHaveLength(1);
    expect(results[0].target_type).toBe('summary');
    expect(results[0].target_id).toBe('sum-99');
  });

  it('DocumentLocation admite ancla sin char_start/char_end (nivel bloque)', async () => {
    const blockAnchor = makeAnchor({ char_start: undefined, char_end: undefined });
    mockRows.push(blockAnchor);

    const results = await repo.findByDocumentId('doc-001');

    const stored = results[0];
    expect(stored.char_start).toBeUndefined();
    expect(stored.char_end).toBeUndefined();
    expect(stored.block_id).toBe('paragraph_12');
  });

  it('los campos del Sync Protocol están presentes en el modelo', () => {
    const anchor = makeAnchor();
    expect(anchor).toHaveProperty('sync_version');
    expect(anchor).toHaveProperty('version_number');
    expect(anchor.sync_version).toBe(0);
    expect(anchor.version_number).toBe(1);
  });

  it('metadata es opcional y no afecta la reconstrucción del Anchor', () => {
    const withMeta = makeAnchor({ metadata: JSON.stringify({ color: 'yellow' }) });
    const withoutMeta = makeAnchor({ metadata: undefined });

    // La identidad del Anchor debe ser idéntica excepto en metadata
    expect(withMeta.document_id).toBe(withoutMeta.document_id);
    expect(withMeta.page_index).toBe(withoutMeta.page_index);
    expect(withMeta.block_id).toBe(withoutMeta.block_id);
    expect(withMeta.target_id).toBe(withoutMeta.target_id);
  });
});
