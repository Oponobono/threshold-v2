/**
 * Multi-Tenant Isolation Tests — Fase 2
 *
 * Valida que SessionBoundRepository garantiza aislamiento total entre sesiones/usuarios.
 * Utiliza el mismo patrón de mock en memoria que BaseRepository.test.ts (sin expo-sqlite real).
 */

// ─── Mocks de infraestructura nativa (DEBEN ir antes de cualquier import del SUT) ───

// Silence react-native-get-random-values (solo necesario para uuid en SessionIdentity)
jest.mock('react-native-get-random-values', () => {});
jest.mock('uuid', () => ({ v4: jest.fn(() => `gen-${Date.now()}-${Math.random()}`) }));

// Mock de RepositoryEventBus para evitar que la infraestructura de eventos explote
jest.mock('../../events/RepositoryEventBus', () => ({
  repositoryEventBus: { emit: jest.fn() },
}));

// Mock de ConflictResolver
jest.mock('../../sync/ConflictResolver', () => ({
  conflictResolver: {
    resolve: jest.fn(() => ({ winner: 'remote', data: {}, version_number: 1 })),
  },
}));

// ─── Mock en memoria de DatabaseService (patrón establecido en BaseRepository.test.ts) ───

const mockTables = new Map<string, Map<string, any>>();

function ensureTable(name: string) {
  if (!mockTables.has(name)) mockTables.set(name, new Map());
  return mockTables.get(name)!;
}

function evalWhere(sql: string, rows: any[], params: any[]): any[] {
  // Soporte para EXISTS con subquery de subjects (indirect ownership para assessments)
  const existsMatch = sql.match(/EXISTS\s*\(SELECT 1 FROM subjects WHERE subjects\.id = \w+\.subject_id AND subjects\.user_id = \?\)/i);
  if (existsMatch) {
    // Buscar user_id en la primera posición del params (la del ownership)
    const ownerUserId = params[0];
    const subjectsTable = ensureTable('subjects');
    rows = rows.filter((r: any) => {
      const subj = subjectsTable.get(r.subject_id);
      return subj && subj.user_id === ownerUserId;
    });
    // Eliminar ese param para no confundir el resto
    params = params.slice(1);
  }

  const m = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$|\))/i);
  if (!m) return rows;
  const clause = m[1];

  if (/deleted_at\s+IS\s+NULL/i.test(clause))
    rows = rows.filter((r: any) => r.deleted_at == null);
  if (/deleted_at\s+IS\s+NOT\s+NULL/i.test(clause))
    rows = rows.filter((r: any) => r.deleted_at != null);

  if (/user_id\s*=\s*\?/i.test(clause)) {
    const uIdx = clause.indexOf('user_id');
    const paramUIdx = (clause.substring(0, uIdx).match(/\?/g) || []).length;
    rows = rows.filter((r: any) => String(r.user_id) === String(params[paramUIdx]));
  }

  const idMatch = clause.match(/\bid\s*=\s*\?/);
  if (idMatch) {
    const before = clause.substring(0, idMatch.index!);
    const paramIdx = (before.match(/\?/g) || []).length;
    rows = rows.filter((r: any) => r.id === params[paramIdx]);
  }

  const fieldMatch = clause.match(/(\w+)\s*=\s*\?(?!.*\bid\s*=)/);
  if (fieldMatch && !['id', 'user_id', 'deleted_at'].includes(fieldMatch[1])) {
    const field = fieldMatch[1];
    const before = clause.substring(0, clause.indexOf(fieldMatch[0]));
    const paramIdx = (before.match(/\?/g) || []).length;
    rows = rows.filter((r: any) => String(r[field]) === String(params[paramIdx]));
  }

  return rows;
}

const db: any = {};

db.getAllAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const from = sql.match(/FROM\s+(\w+)/i);
  if (!from) return [];
  // PRAGMA table_info
  if (/PRAGMA\s+table_info/i.test(sql)) {
    const tableName = from[1];
    const tableRows = Array.from(ensureTable(tableName).values());
    if (tableRows.length === 0) return [];
    return Object.keys(tableRows[0]).map(name => ({ name }));
  }
  const allParams = params.flat();
  return evalWhere(sql, Array.from(ensureTable(from[1]).values()), allParams);
});

db.getFirstAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const allParams = params.flat();
  const isCount = /COUNT\s*\(\s*\*\s*\)/i.test(sql);
  const rows = await db.getAllAsync(sql, ...allParams);
  if (isCount) return { count: rows.length };
  return rows[0] || null;
});

db.runAsync = jest.fn(async (sql: string, ...params: any[]) => {
  const allParams = params.flat();

  const insert = sql.match(/INSERT\s+INTO\s+(\w+)/i);
  if (insert) {
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (colMatch) {
      const cols = colMatch[1].split(',').map((c: string) => c.trim());
      const obj: any = {};
      cols.forEach((col: string, i: number) => { obj[col] = allParams[i]; });
      const table = ensureTable(insert[1]);
      if (table.has(obj.id)) throw new Error(`UNIQUE constraint failed: ${insert[1]}.id`);
      table.set(obj.id, obj);
    }
    return {};
  }

  const update = sql.match(/UPDATE\s+(\w+)/i);
  if (update) {
    const tableName = update[1];
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
    if (setMatch) {
      const setParts = setMatch[1];
      const pairs: { k: string; v: string }[] = [];
      let remaining = setParts;
      const setRegex = /(\w+)\s*=\s*(\?|datetime\('[^)]*'\)|COALESCE[^,]+|\d+|'[^']*')/g;
      let m2: RegExpExecArray | null;
      while ((m2 = setRegex.exec(remaining)) !== null) {
        pairs.push({ k: m2[1], v: m2[2] });
      }

      // params order: set values first, then WHERE id = ?, then ownership params
      // Figure out which param is the id:
      const wherePart = sql.substring(sql.lastIndexOf('WHERE'));
      const idInWhereMatch = wherePart.match(/\bid\s*=\s*\?/i);
      const countQmarks = (sql.substring(0, sql.lastIndexOf('WHERE')).match(/\?/g) || []).length;
      const idParamIdx = countQmarks; // first ? after SET placeholders is the id

      const targetId = allParams[idParamIdx];
      if (!targetId) return {};

      // Check ownership: get the ownership param(s) after id param
      const ownershipParam = allParams[idParamIdx + 1];
      const existing = ensureTable(tableName).get(targetId);
      if (!existing) return {};
      if (ownershipParam && existing.user_id !== ownershipParam) return {}; // ownership mismatch → no-op

      // Apply SET
      let paramIdx = 0;
      pairs.forEach(({ k, v }) => {
        if (k === 'id') return; // skip
        if (v === '?') {
          existing[k] = allParams[paramIdx++];
        } else if (/datetime/i.test(v)) {
          existing[k] = new Date().toISOString();
        } else if (/COALESCE/i.test(v)) {
          existing[k] = (existing[k] || 0) + 1;
        } else if (/^\d+$/.test(v)) {
          existing[k] = Number(v);
          paramIdx;
        } else {
          existing[k] = v.replace(/^'|'$/g, '');
        }
      });
      ensureTable(tableName).set(targetId, existing);
    }
    return {};
  }

  const del = sql.match(/DELETE\s+FROM\s+(\w+)/i);
  if (del) {
    const tableName = del[1];
    const wherePart = sql.substring(sql.lastIndexOf('WHERE'));
    const hasIdWhere = /\bid\s*=\s*\?/i.test(wherePart);
    if (hasIdWhere) {
      const idParam = allParams[0];
      const ownershipParam = allParams[1];
      const existing = ensureTable(tableName).get(idParam);
      if (!existing) return {};
      if (ownershipParam && existing.user_id !== ownershipParam) return {}; // ownership mismatch → no-op
      ensureTable(tableName).delete(idParam);
    }
    return {};
  }

  return {};
});

db.execAsync = jest.fn(async (sql: string) => {
  // Support manual inserts in tests (bypassing ownership)
  const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/is);
  if (insertMatch) {
    const tableName = insertMatch[1].trim();
    const cols = insertMatch[2].split(',').map((c: string) => c.trim());
    const vals = insertMatch[3].split(',').map((v: string) => v.trim().replace(/^'|'$/g, ''));
    const obj: any = {};
    cols.forEach((col, i) => { obj[col] = vals[i]; });
    ensureTable(tableName).set(obj.id, obj);
  }
});

jest.mock('../DatabaseService', () => {
  class MockDatabaseService {
    getDb(): any { return db; }
    async open(): Promise<any> { return db; }
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
    async clearAll(): Promise<void> { mockTables.clear(); }
  }
  return { databaseService: new MockDatabaseService(), DatabaseService: MockDatabaseService };
});

// ─── Ahora podemos importar los módulos bajo test ───
import { sessionIdentity, SessionBoundContext } from '../../api/auth/SessionIdentity';
import { SessionBoundRepository } from '../SessionBoundRepository';
import { Course } from '../../api/types';
import { Assessment } from '../repositories/AssessmentRepository';

// ─── Implementación directa de test (Direct ownership — user_id = ?) ───
class TestCourseRepo extends SessionBoundRepository<Course> {
  constructor(context: SessionBoundContext) { super('courses', context); }
  protected buildOwnershipWhereClause(): string { return 'user_id = ?'; }
  protected enforceCreateOwnership(data: Partial<Course>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }
}

// ─── Implementación directa de test (Indirect ownership — EXISTS) ───
class TestAssessmentRepo extends SessionBoundRepository<Assessment> {
  constructor(context: SessionBoundContext) { super('assessments', context); }
  protected buildOwnershipWhereClause(): string {
    return 'EXISTS (SELECT 1 FROM subjects WHERE subjects.id = assessments.subject_id AND subjects.user_id = ?)';
  }
  protected async enforceCreateOwnership(data: Partial<Assessment>): Promise<void> {
    if (!data.subject_id) throw new Error('ILLEGAL_CREATE: subject_id required');
    const row = await db.getFirstAsync('SELECT user_id FROM subjects WHERE id = ?', data.subject_id);
    if (!row || row.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: subject_id does not belong to current user');
  }
}

// ─── Helpers ───
function loginA() {
  sessionIdentity.startSession('UserA');
  return sessionIdentity.getBoundContext();
}
function loginB() {
  sessionIdentity.startSession('UserB');
  return sessionIdentity.getBoundContext();
}
function logout() {
  sessionIdentity.clearSession();
}
function clearTables() {
  mockTables.clear();
  db.getAllAsync.mockClear();
  db.getFirstAsync.mockClear();
  db.runAsync.mockClear();
  db.execAsync.mockClear();
}

// ──────────────────────────────────────────────
describe('Multi-Tenant Isolation — Fase 2', () => {
  beforeEach(() => {
    clearTables();
    logout();
  });

  // ──────────────────────────────────────────────
  describe('Test A: SQLite residual — B no puede ver datos de A', () => {
    it('B no obtiene cursos de A aunque estén en la DB', async () => {
      // Insert A's data directamente (bypass de ownership)
      await db.execAsync(`INSERT INTO courses (id, user_id, name) VALUES ('courseA1', 'UserA', 'Course A')`);

      // Login B
      const ctxB = loginB();
      const repoB = new TestCourseRepo(ctxB);

      const all = await repoB.getAll();
      expect(all).toHaveLength(0);
      expect(all.find((c: any) => c.id === 'courseA1')).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  describe('Test B: In-flight Race — operación concurrent abortada al cambiar sesión', () => {
    it('operación iniciada en G1 lanza SESSION_CONTEXT_INVALID si la sesión cambia antes de escribir', async () => {
      // Simula una operación que captura el contexto, luego la sesión cambia, luego intenta escribir
      const ctxA = loginA();
      const repoA = new TestCourseRepo(ctxA);

      // Simular que la operación tardó en ejecutarse: el contexto se guarda en closure
      // pero la sesión cambia ANTES de que intente llamar a SQLite
      logout();
      loginB(); // sesión nueva

      // La operación in-flight con el contexto de A debe fallar
      await expect(repoA.create({ name: 'In-flight' } as any)).rejects.toThrow('SESSION_CONTEXT_INVALID');

      // B tampoco debe ver ninguna fila de A
      const ctxB = sessionIdentity.getBoundContext();
      const repoB = new TestCourseRepo(ctxB!);
      expect(await repoB.getAll()).toHaveLength(0);
    });

    it('operación in-flight de G1 no contamina la sesión G2 del mismo usuario', async () => {
      const ctxA1 = loginA();
      const repoA1 = new TestCourseRepo(ctxA1);

      // Re-login del mismo usuario genera nueva generation
      logout();
      const ctxA2 = loginA();
      const repoA2 = new TestCourseRepo(ctxA2);

      // repo de G1 ya no puede escribir
      await expect(repoA1.create({ name: 'G1 write' } as any)).rejects.toThrow('SESSION_CONTEXT_INVALID');

      // repo de G2 sí puede crear sin que el error de G1 lo afecte
      const created = await repoA2.create({ name: 'G2 write' } as any);
      expect(created.user_id).toBe('UserA');
    });
  });

  // ──────────────────────────────────────────────
  describe('Test C: Stale Repository — repo viejo es invalidado', () => {
    it('lanza SESSION_CONTEXT_INVALID y NO llama a SQLite', async () => {
      // A login → crea repo
      const ctxA = loginA();
      const repoA = new TestCourseRepo(ctxA);

      // Logout A → login B
      logout();
      loginB();

      // Repo de A/G1 debe fallar en cualquier operación
      const runSpy = jest.spyOn(db, 'runAsync');
      const getAllSpy = jest.spyOn(db, 'getAllAsync');

      await expect(repoA.getAll()).rejects.toThrow('SESSION_CONTEXT_INVALID');
      await expect(repoA.getById('any')).rejects.toThrow('SESSION_CONTEXT_INVALID');
      await expect(repoA.create({ name: 'Hack' } as any)).rejects.toThrow('SESSION_CONTEXT_INVALID');
      await expect(repoA.update('any', { name: 'Hack' } as any)).rejects.toThrow('SESSION_CONTEXT_INVALID');
      await expect(repoA.delete('any')).rejects.toThrow('SESSION_CONTEXT_INVALID');
      await expect(repoA.hardDelete('any')).rejects.toThrow('SESSION_CONTEXT_INVALID');
      await expect(repoA.count()).rejects.toThrow('SESSION_CONTEXT_INVALID');

      // SQLite NO debe haber sido llamado en ninguna de las operaciones de arriba
      expect(getAllSpy).not.toHaveBeenCalled();
      expect(runSpy).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  describe('Test D: Cross-Tenant Attack — B no puede leer/modificar/borrar entidades de A', () => {
    it('READ: B no puede leer entidades de A', async () => {
      await db.execAsync(`INSERT INTO courses (id, user_id, name) VALUES ('courseA', 'UserA', 'A Course')`);

      const ctxB = loginB();
      const repoB = new TestCourseRepo(ctxB);

      expect(await repoB.getById('courseA')).toBeNull();
      expect(await repoB.getByField('name', 'A Course')).toHaveLength(0);
      expect(await repoB.count()).toBe(0);
      expect(await repoB.getByIdIncludingDeleted('courseA')).toBeNull();
    });

    it('UPDATE: B no puede modificar entidades de A', async () => {
      await db.execAsync(`INSERT INTO courses (id, user_id, name) VALUES ('courseA', 'UserA', 'Original')`);

      const ctxB = loginB();
      const repoB = new TestCourseRepo(ctxB);

      await repoB.update('courseA', { name: 'Hacked' } as any);

      // La fila de A debe estar intacta
      const row = ensureTable('courses').get('courseA');
      expect(row?.name).toBe('Original');
    });

    it('DELETE: B no puede soft-delete entidades de A', async () => {
      await db.execAsync(`INSERT INTO courses (id, user_id, name) VALUES ('courseA', 'UserA', 'Original')`);

      const ctxB = loginB();
      const repoB = new TestCourseRepo(ctxB);

      await repoB.delete('courseA');

      const row = ensureTable('courses').get('courseA');
      expect(row?.deleted_at).toBeUndefined(); // No fue soft-deleted
    });

    it('HARD DELETE: B no puede eliminar entidades de A', async () => {
      await db.execAsync(`INSERT INTO courses (id, user_id, name) VALUES ('courseA', 'UserA', 'Original')`);

      const ctxB = loginB();
      const repoB = new TestCourseRepo(ctxB);

      await repoB.hardDelete('courseA');

      // La fila de A debe seguir existiendo
      expect(ensureTable('courses').has('courseA')).toBe(true);
    });

    it('UPSERT: B no puede hacer upsert de un id que pertenece a A (falla en UNIQUE)', async () => {
      await db.execAsync(`INSERT INTO courses (id, user_id, name) VALUES ('courseA', 'UserA', 'Original')`);

      const ctxB = loginB();
      const repoB = new TestCourseRepo(ctxB);

      // B intenta upsert con el mismo id: getByIdIncludingDeleted devuelve null (no ve la fila de A),
      // por lo que intenta un INSERT que falla por UNIQUE constraint
      await expect(
        repoB.upsert({ id: 'courseA', name: 'Upserted', user_id: 'UserB' } as any)
      ).rejects.toThrow();

      // La fila de A no fue modificada
      const row = ensureTable('courses').get('courseA');
      expect(row?.name).toBe('Original');
      expect(row?.user_id).toBe('UserA');
    });
  });

  // ──────────────────────────────────────────────
  describe('Test E: CREATE — ownership inyectada por contexto, no por caller', () => {
    it('CREATE asigna user_id del contexto, ignorando el campo del caller', async () => {
      const ctxA = loginA();
      const repoA = new TestCourseRepo(ctxA);

      const created = await repoA.create({ name: 'My Course' } as any);
      expect(created.user_id).toBe('UserA');

      const rows = Array.from(ensureTable('courses').values());
      expect(rows).toHaveLength(1);
      expect(rows[0].user_id).toBe('UserA');
    });

    it('CREATE rechaza si el caller intenta forzar un user_id diferente', async () => {
      const ctxA = loginA();
      const repoA = new TestCourseRepo(ctxA);

      await expect(
        repoA.create({ name: 'Hack', user_id: 'UserB' } as any)
      ).rejects.toThrow('ILLEGAL_CREATE');
    });
  });

  // ──────────────────────────────────────────────
  describe('Test F: Indirect Ownership (Assessment via Subject)', () => {
    it('CREATE rechaza assessment si el subject_id no pertenece al usuario actual', async () => {
      // A crea un subject
      await db.execAsync(`INSERT INTO subjects (id, user_id, name) VALUES ('subjA', 'UserA', 'SubjA')`);

      const ctxB = loginB();
      const repoB = new TestAssessmentRepo(ctxB);

      await expect(
        repoB.create({ subject_id: 'subjA', name: 'Hack' } as any)
      ).rejects.toThrow('ILLEGAL_CREATE');
    });

    it('READ: B no puede leer assessments de A (filtro EXISTS)', async () => {
      await db.execAsync(`INSERT INTO subjects (id, user_id, name) VALUES ('subjA', 'UserA', 'SubjA')`);
      await db.execAsync(`INSERT INTO assessments (id, subject_id, name) VALUES ('assessA', 'subjA', 'Exam A')`);

      const ctxB = loginB();
      const repoB = new TestAssessmentRepo(ctxB);

      const results = await repoB.getAll();
      expect(results).toHaveLength(0);
      expect(await repoB.getById('assessA')).toBeNull();
    });
  });

  // ──────────────────────────────────────────────
  describe('Test G: Aislamiento después de re-login (mismo usuario)', () => {
    it('repo de sesión G1 es inválido después de logout/re-login del mismo usuario', async () => {
      const ctxA1 = loginA();
      const repoA1 = new TestCourseRepo(ctxA1);

      logout();
      loginA(); // re-login → genera nueva generation

      // El repo de G1 ya es inválido aunque sea el mismo usuario
      await expect(repoA1.getAll()).rejects.toThrow('SESSION_CONTEXT_INVALID');
    });
  });
});
