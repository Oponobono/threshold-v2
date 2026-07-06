import * as SQLite from 'expo-sqlite';
import migrations from './migrations';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private openingPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
