import { FlashcardDomainService } from '../FlashcardDomainService';
import { flashcardDeckRepository } from '../../database/repositories/FlashcardDeckRepository';
import { flashcardRepository } from '../../database/repositories/FlashcardRepository';

/**
 * Test de convergencia: ruta de persistencia inmediata (saveGeneratedDeck)
 * == ruta de Delta Sync (upsertMany).
 *
 * Un mazo creado por el backend llega al dispositivo por DOS caminos:
 *   A) saveGeneratedDeck  → create()/update() por entidad (respuesta del POST).
 *   B) upsertMany         → Delta Sync (pull posterior).
 * Ambos deben converger al MISMO estado final sin duplicar deck ni cards.
 *
 * El bug real estaba en backend (saveAggregate generaba card.id nuevos),
 * lo que rompía la correspondencia ids-respuesta vs ids-BD → el delta sync
 * volvía a insertar cards. Este test blinda el contrato en el cliente.
 */

const mockTables = new Map<string, Map<string, any>>();
function ensureTable(name: string) {
  if (!mockTables.has(name)) mockTables.set(name, new Map());
  return mockTables.get(name)!;
}
function tableRows(name: string) {
  return Array.from(ensureTable(name).values());
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

  if (/deleted_at\s+IS\s+NULL/i.test(clause)) rows = rows.filter((r: any) => r.deleted_at == null);
  if (/deleted_at\s+IS\s+NOT\s+NULL/i.test(clause)) rows = rows.filter((r: any) => r.deleted_at != null);
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

function clearMockTables() {
  mockTables.clear();
}

jest.mock('../../database/DatabaseService', () => {
  class MockDatabaseService {
    async open(): Promise<any> { return db; }
    getDb(): any { return db; }
    async close(): Promise<void> {}
    async getAllTracked(sql: string, params?: any[], _label?: string): Promise<any[]> {
      return db.getAllAsync(sql, ...(params || []));
    }
    async getFirstTracked(sql: string, params?: any[], _label?: string): Promise<any | null> {
      return db.getFirstAsync(sql, ...(params || []));
    }
    async runTracked(sql: string, params?: any[], _label?: string): Promise<any> {
      return db.runAsync(sql, ...(params || []));
    }
  }
  return { databaseService: new MockDatabaseService(), DatabaseService: MockDatabaseService };
});

jest.mock('../../api/auth', () => ({
  getUserId: () => Promise.resolve('user-1'),
}));

const service = new FlashcardDomainService();

const deckPayload = {
  id: 'deck-back-1',
  title: 'Expo en React — Programación',
  description: '',
  topic: 'Expo en React',
  subjectId: 'subject-1',
  cards: [
    { id: 'card-1', deckId: 'deck-back-1', front: '¿Qué es Expo?', back: 'Framework de RN', item_type: 'flashcard' },
    { id: 'card-2', deckId: 'deck-back-1', front: '¿Qué es RN?', back: 'Librería móvil', item_type: 'flashcard' },
  ],
};

describe('Convergencia: saveGeneratedDeck (inmediato) vs upsertMany (Delta Sync)', () => {
  beforeEach(() => {
    clearMockTables();
    jest.clearAllMocks();
  });

  it('A: saveGeneratedDeck, luego B: upsertMany del mismo payload → 1 deck, 2 cards', async () => {
    await service.saveGeneratedDeck(deckPayload);

    const deckRow = tableRows('flashcard_decks').filter((r: any) => r.id === 'deck-back-1');
    expect(deckRow).toHaveLength(1);

    await flashcardDeckRepository.upsertMany([
      { id: 'deck-back-1', user_id: 'user-1', title: deckPayload.title, topic: deckPayload.topic, version_number: 2 },
    ] as any);
    await flashcardRepository.upsertMany(deckPayload.cards.map((c) => ({
      id: c.id,
      deck_id: c.deckId,
      front: c.front,
      back: c.back,
      item_type: c.item_type,
      version_number: 2,
    })) as any);

    expect(tableRows('flashcard_decks').filter((r: any) => r.id === 'deck-back-1')).toHaveLength(1);
    expect(tableRows('flashcards').filter((r: any) => r.deck_id === 'deck-back-1')).toHaveLength(2);
    expect(tableRows('flashcards').map((r: any) => r.id).sort()).toEqual(['card-1', 'card-2']);
  });

  it('B: upsertMany primero (otro dispositivo), luego saveGeneratedDeck → sin duplicar', async () => {
    await flashcardDeckRepository.upsertMany([
      { id: 'deck-back-1', user_id: 'user-1', title: deckPayload.title, topic: deckPayload.topic, version_number: 1 },
    ] as any);
    await flashcardRepository.upsertMany(deckPayload.cards.map((c) => ({
      id: c.id,
      deck_id: c.deckId,
      front: c.front,
      back: c.back,
      item_type: c.item_type,
      version_number: 1,
    })) as any);

    await service.saveGeneratedDeck(deckPayload);

    expect(tableRows('flashcard_decks').filter((r: any) => r.id === 'deck-back-1')).toHaveLength(1);
    expect(tableRows('flashcards').filter((r: any) => r.deck_id === 'deck-back-1')).toHaveLength(2);
  });

  it('dos ciclos de sync con el mismo payload no incrementan la cantidad de rows', async () => {
    await service.saveGeneratedDeck(deckPayload);

    for (let i = 0; i < 2; i++) {
      await flashcardDeckRepository.upsertMany([
        { id: 'deck-back-1', user_id: 'user-1', title: deckPayload.title, topic: deckPayload.topic, version_number: 2 },
      ] as any);
      await flashcardRepository.upsertMany(deckPayload.cards.map((c) => ({
        id: c.id,
        deck_id: c.deckId,
        front: c.front,
        back: c.back,
        item_type: c.item_type,
        version_number: 2,
      })) as any);
    }

    expect(tableRows('flashcard_decks')).toHaveLength(1);
    expect(tableRows('flashcards')).toHaveLength(2);
  });

  it('el título y el topic convergen al valor del backend (payload autoritativo)', async () => {
    await service.saveGeneratedDeck({ ...deckPayload, title: 'Título local provisional' });

    await flashcardDeckRepository.upsertMany([
      { id: 'deck-back-1', user_id: 'user-1', title: 'Expo en React — Programación', topic: 'Expo en React', version_number: 2 },
    ] as any);

    const row = tableRows('flashcard_decks')[0];
    expect(row.title).toBe('Expo en React — Programación');
    expect(row.topic).toBe('Expo en React');
  });
});
