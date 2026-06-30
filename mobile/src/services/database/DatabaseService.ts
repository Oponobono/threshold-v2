import * as SQLite from 'expo-sqlite';
import migrations from './migrations';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async open(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) return this.db;
    this.db = await SQLite.openDatabaseAsync('threshold.db');
    await this.db.execAsync('PRAGMA journal_mode = WAL');
    await this.db.execAsync('PRAGMA foreign_keys = ON');
    
    await this.runMigrations();
    return this.db;
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

  private async runMigrations(): Promise<void> {
    const db = this.db!;
    const currentVersion = await this.getUserVersion();
    for (let i = currentVersion; i < migrations.length; i++) {
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
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.execAsync(`PRAGMA user_version = ${migrations[i].version}`);
        });
        continue;
      }

      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const stmt of filtered) {
          await txn.execAsync(stmt);
        }
        await txn.execAsync(`PRAGMA user_version = ${migrations[i].version}`);
      });
    }
  }

  private async getUserVersion(): Promise<number> {
    const row: any = await this.db!.getFirstAsync('PRAGMA user_version');
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
