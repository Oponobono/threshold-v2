import * as SQLite from 'expo-sqlite';
import migrations from './migrations';

interface QueryTrace {
  id: number;
  label: string;
  enqueueTime: number;
  startTime: number;
  queueDepth: number;
  duration: number;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private openingPromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private queryCounter = 0;
  private pendingCount = 0;
  private slowThreshold = 50;
  private lastOp: Promise<void> = Promise.resolve();
  private t0 = 0;

  async getAllTracked<T = any>(sql: string, params?: any[], label?: string): Promise<T[]> {
    return this._track<T[]>(label || sql.substring(0, 60), () => this.getDb().getAllAsync(sql, params as any));
  }

  async getFirstTracked<T = any>(sql: string, params?: any[], label?: string): Promise<T | null> {
    return this._track<T | null>(label || sql.substring(0, 60), () => this.getDb().getFirstAsync(sql, params as any));
  }

  async runTracked(sql: string, params?: any[], label?: string): Promise<SQLite.SQLiteRunResult> {
    return this._track<SQLite.SQLiteRunResult>(label || sql.substring(0, 60), () => this.getDb().runAsync(sql, params as any));
  }

  async execTracked(sql: string, label?: string): Promise<void> {
    return this._track<void>(label || sql.substring(0, 60), () => this.getDb().execAsync(sql));
  }

  private _getCaller(): string {
    try {
      const stack = new Error().stack;
      if (!stack) return '';
      const lines = stack.split('\n');
      // frame 0 = _getCaller, 1 = _track, 2 = getAllTracked/getFirstTracked/runTracked/execTracked, 3 = real caller
      for (let i = 3; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.includes('DatabaseService.') && !line.includes('/DatabaseService')) {
          return line.substring(0, 80);
        }
      }
      return '';
    } catch { return ''; }
  }

  private async _track<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const id = ++this.queryCounter;
    const enqueueTime = performance.now();
    if (!this.t0) this.t0 = enqueueTime;
    const queueDepth = this.pendingCount;
    this.pendingCount++;
    const caller = __DEV__ ? this._getCaller() : '';
    const ms = (enqueueTime - this.t0).toFixed(0);
    console.log(`[Queue] #${id} "${label}" → enq +${ms}ms depth=${queueDepth}${caller ? ` caller=${caller}` : ''}`);

    const turno = this.lastOp.catch(() => {});
    const miOp = turno.then(async () => {
      const startTime = performance.now();
      const waitMs = startTime - enqueueTime;
      if (waitMs > 2) {
        console.log(`[Queue] #${id} "${label}" ◆ start +${(startTime - this.t0).toFixed(0)}ms waited=${waitMs.toFixed(0)}ms`);
      }
      let bridgeMs = 0;
      let createMs = 0;
      try {
        const tCreate = performance.now();
        const promise = fn();
        createMs = performance.now() - tCreate;
        const tBridge = performance.now();
        const result = await promise;
        bridgeMs = performance.now() - tBridge;
        const now = performance.now();
        if (bridgeMs > 2) {
          console.log(`[Queue] #${id} "${label}" ◆ sql_ok +${(now - this.t0).toFixed(0)}ms create=${createMs.toFixed(2)}ms bridge=${bridgeMs.toFixed(0)}ms`);
        }
        return result;
      } finally {
        const doneTime = performance.now();
        this.pendingCount--;
        const totalMs = doneTime - enqueueTime;
        const restMs = totalMs - waitMs - createMs - bridgeMs;
        console.log(`[Queue] #${id} "${label}" ← done +${(doneTime - this.t0).toFixed(0)}ms total=${totalMs.toFixed(0)}ms bridge=${bridgeMs.toFixed(0)}ms create=${createMs.toFixed(2)}ms wait=${waitMs.toFixed(0)}ms rest=${restMs.toFixed(0)}ms`);
      }
    });
    this.lastOp = miOp.then(() => {}, () => {});

    return miOp;
  }

  private async _measure(db: SQLite.SQLiteDatabase, sql: string): Promise<number> {
    const t0 = performance.now();
    await db.getAllAsync(sql);
    return performance.now() - t0;
  }

  async open(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) { console.log('[BOOT 04] DB already open, returning cached'); return this.db; }
    if (this.openingPromise) { console.log('[BOOT 03a] open() already in progress, awaiting...'); return this.openingPromise; }

    this.openingPromise = (async () => {
      let db: SQLite.SQLiteDatabase | null = null;
      try {
        console.log('[BOOT 03] Calling SQLite.openDatabaseAsync...');
        db = await SQLite.openDatabaseAsync('threshold.db');
        console.log('[BOOT 04] SQLite DB handle acquired');
        await db.execAsync('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
        console.log('[BOOT 04a] PRAGMAs done (busy_timeout, journal_mode=WAL, foreign_keys=ON)');
        console.log('[BOOT 05] Running migrations...');
        await this.runMigrationsCore(db);
        console.log('[BOOT 05z] Migrations complete');

        // Benchmark JSI round-trip overhead (dev only, diagnostic)
        if (__DEV__) {
          try {
            console.log('[DB Bench] ╔═══════════════════════════════════════════════════╗');
            console.log('[DB Bench] ║  JSI round-trip benchmark (cold start)           ║');
            console.log('[DB Bench] ╚═══════════════════════════════════════════════════╝');
            let t = await this._measure(db, 'SELECT 1');
            console.log(`[DB Bench] SELECT 1                                    ${t.toFixed(1).padStart(8)} ms`);
            t = await this._measure(db, 'SELECT 1 as a,2 b,3 c,4 d,5 e,6 f,7 g,8 h,9 i,10 j');
            console.log(`[DB Bench] SELECT 1 (10 cols)                          ${t.toFixed(1).padStart(8)} ms`);
            t = await this._measure(db, 'SELECT COUNT(*) FROM flashcard_decks');
            console.log(`[DB Bench] SELECT COUNT(*) flashcard_decks              ${t.toFixed(1).padStart(8)} ms`);
            t = await this._measure(db, 'SELECT COUNT(*) FROM flashcards');
            console.log(`[DB Bench] SELECT COUNT(*) flashcards                   ${t.toFixed(1).padStart(8)} ms`);
            t = await this._measure(db, 'SELECT COUNT(*) FROM subjects');
            console.log(`[DB Bench] SELECT COUNT(*) subjects                     ${t.toFixed(1).padStart(8)} ms`);
            t = await this._measure(db, 'SELECT * FROM flashcard_decks');
            console.log(`[DB Bench] SELECT * flashcard_decks                     ${t.toFixed(1).padStart(8)} ms`);
            t = await this._measure(db, 'SELECT * FROM flashcards LIMIT 1');
            console.log(`[DB Bench] SELECT * flashcards LIMIT 1                  ${t.toFixed(1).padStart(8)} ms`);
            t = await this._measure(db, 'SELECT * FROM flashcards LIMIT 120');
            console.log(`[DB Bench] SELECT * flashcards LIMIT 120                ${t.toFixed(1).padStart(8)} ms`);

            // ── GPA query profile ──────────────────────────────────────────
            try {
              const plan: any[] = await db.getAllAsync(
                `EXPLAIN QUERY PLAN
                 SELECT a.subject_id, a.grade_value, a.score, a.out_of, a.percentage, a.weight, a.normalized_value
                 FROM assessments a
                 JOIN subjects s ON a.subject_id = s.id
                 WHERE s.user_id = 'test'
                 AND a.deleted_at IS NULL AND s.deleted_at IS NULL
                 AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL OR a.normalized_value IS NOT NULL)
                 ORDER BY a.date ASC`
              );
              for (const row of plan) {
                console.log(`[GPAProfile] EXPLAIN: ${row.detail || JSON.stringify(row)}`);
              }
            } catch (_) {}
            try {
              const idx: any[] = await db.getAllAsync("PRAGMA index_list(assessments)");
              for (const row of idx) {
                console.log(`[GPAProfile] INDEX assessments: ${row.name} (${row.unique ? 'UNIQUE' : 'NON-UNIQUE'}) cols=${row.seq}`);
              }
              const idx2: any[] = await db.getAllAsync("PRAGMA index_list(subjects)");
              for (const row of idx2) {
                console.log(`[GPAProfile] INDEX subjects: ${row.name} (${row.unique ? 'UNIQUE' : 'NON-UNIQUE'}) cols=${row.seq}`);
              }
            } catch (_) {}
            // Count total rows in assessment (including deleted) to understand data volume
            try {
              const cnt: any[] = await db.getAllAsync('SELECT COUNT(*) as c, SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active FROM assessments');
              if (cnt.length > 0) {
                console.log(`[GPAProfile] assessments: total=${cnt[0].c} active=${cnt[0].active}`);
              }
            } catch (_) {}
          } catch (e) {
            console.warn('[DB Bench] Skipped (table may not exist yet):', e);
          }
        }

        // Warm up expo-sqlite for complex queries. Must use a real userId so the planner
        // chooses the same strategy as real queries and the cursor actually traverses JOINs.
        console.log('[BOOT 07b] Warming up complex queries...');
        const tWarm = performance.now();
        let warmUserId = '';
        try {
          const rows = await db.getAllAsync<{ id: string }>(
            'SELECT id FROM users LIMIT 1'
          );
          if (rows.length > 0) warmUserId = rows[0].id;
        } catch (_) {}
        if (warmUserId) {
          const tGpa = performance.now();
          try {
            const r = await db.getAllAsync(
              `SELECT a.subject_id, a.grade_value, a.score, a.out_of, a.percentage, a.weight, a.normalized_value
               FROM assessments a
               JOIN subjects s ON a.subject_id = s.id
               WHERE s.user_id = ?
               AND a.deleted_at IS NULL
               AND s.deleted_at IS NULL
               AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL OR a.normalized_value IS NOT NULL)
               ORDER BY a.date ASC`,
              [warmUserId]
            );
            console.log(`[Warmup] GPA: ${r.length} rows, ${(performance.now()-tGpa).toFixed(1)} ms`);
          } catch (_) {}
          const tKnow = performance.now();
          try {
            const r = await db.getAllAsync(
              `SELECT fc.id, fc.deck_id, fc.status,
                fc.next_review_date, fc.last_review_timestamp,
                fc.fsrs_stability, fc.fsrs_difficulty, fc.fsrs_repetitions,
                fd.subject_id,
                COALESCE(s.name, '') as subject_name
               FROM flashcards fc
               JOIN flashcard_decks fd ON fc.deck_id = fd.id
               LEFT JOIN subjects s ON fd.subject_id = s.id AND s.deleted_at IS NULL
               WHERE fd.user_id = ?
               AND fc.deleted_at IS NULL
               AND fd.deleted_at IS NULL`,
              [warmUserId]
            );
            console.log(`[Warmup] Knowledge: ${r.length} rows, ${(performance.now()-tKnow).toFixed(1)} ms`);
          } catch (_) {}
        }
        console.log(`[BOOT 07c] Warmup done: ${(performance.now() - tWarm).toFixed(0)}ms`);

        this.db = db;
        this.openingPromise = null;
        return this.db;
      } catch (e) {
        this.openingPromise = null;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('locked') && db) {
          try { await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
        }
        try { await db?.closeAsync(); } catch {}
        throw e;
      }
    })();

    return this.openingPromise;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  getDb(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('Database not opened. Call open() first.');
    return this.db;
  }

  private async runMigrationsCore(db: SQLite.SQLiteDatabase): Promise<void> {
    const currentVersion = await this.getUserVersionCore(db);
    console.log(`[BOOT 05a] Current DB version: ${currentVersion}, target: ${migrations.length}`);
    for (let i = currentVersion; i < migrations.length; i++) {
      console.log(`[BOOT 05b] Running migration ${migrations[i].version} (${migrations[i].up.length} statements)`);
      const statements = migrations[i].up;
      const filtered: string[] = [];

      for (const stmt of statements) {
        const alterMatch = stmt.match(/^ALTER\s+TABLE\s+(\w+)\s+ADD\s+(COLUMN\s+)?(\w+)\s/i);
        if (alterMatch) {
          const tableName = alterMatch[1];
          const columnName = alterMatch[3];
          try {
            const tableInfo: any[] = await db.getAllAsync(`PRAGMA table_info(${tableName})`);
            const exists = tableInfo.some(col => col.name === columnName);
            if (exists) {
              console.log(`[Migracion] Saltando: ${stmt} (columna ya existe)`);
              continue;
            }
          } catch {
            // Si falla PRAGMA table_info, ejecutar el statement original
          }
        }
        filtered.push(stmt);
      }

      if (filtered.length === 0) {
        console.log(`[Migracion] No hay statements para migration ${migrations[i].version}, solo actualizando user_version`);
        await db.execAsync(`PRAGMA user_version = ${migrations[i].version}`);
        continue;
      }

      console.log(`[Migracion] Ejecutando ${filtered.length} statements uno por uno (auto-commit, sin BEGIN/COMMIT)`);
      let allOk = true;
      for (const stmt of filtered) {
        try {
          console.log(`[Migracion] > ${stmt.substring(0, 120)}`);
          await db.execAsync(stmt);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Ignorar "duplicate column" en ALTER TABLE (columna ya existe)
          if (msg.includes('duplicate column')) {
            console.log(`[Migracion] Saltando (columna ya existe): ${stmt.substring(0, 80)}`);
            continue;
          }
          console.log(`[Migracion] ERROR en statement: ${msg}`);
          allOk = false;
          throw e;
        }
      }
      if (allOk) {
        await db.execAsync(`PRAGMA user_version = ${migrations[i].version}`);
        console.log(`[Migracion] Migration ${migrations[i].version} completada, user_version actualizado`);
      }
    }
  }

  private async getUserVersionCore(db: SQLite.SQLiteDatabase): Promise<number> {
    const row: any = await db.getFirstAsync('PRAGMA user_version');
    return row?.user_version ?? 0;
  }

  async beginTransaction(): Promise<void> {
    await this.db!.execAsync('BEGIN');
  }

  async commitTransaction(): Promise<void> {
    await this.db!.execAsync('COMMIT');
  }

  async rollbackTransaction(): Promise<void> {
    await this.db!.execAsync('ROLLBACK');
  }

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await fn();
      await this.commitTransaction();
      return result;
    } catch (err) {
      await this.rollbackTransaction();
      throw err;
    }
  }

  async clearAll(): Promise<void> {
    const db = this.db;
    if (!db) return;
    const tables = [
      'subjects', 'assessments', 'assessment_categories', 'schedules',
      'flashcard_decks', 'flashcards', 'card_logs', 'study_sessions',
      'photos', 'audio_recordings', 'youtube_videos', 'scanned_documents',
      'calendar_events', 'grading_periods', 'lms_accounts', 'subject_threshold_overrides', 'sync_queue',
    ];
    for (const table of tables) {
      try { await db.execAsync(`DELETE FROM ${table}`); } catch {}
    }
    try { await db.execAsync('VACUUM'); } catch {}
  }
}

export const databaseService = new DatabaseService();
