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
    // Las migraciones están en un array 0-indexed. La versión 1 está en el índice 0.
    for (let i = currentVersion; i < migrations.length; i++) {
      await db.withExclusiveTransactionAsync(async (txn) => {
        for (const stmt of migrations[i].up) {
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

  async clearAll(): Promise<void> {
    const db = this.db;
    if (!db) return;
    const tables = [
      'subjects', 'assessments', 'assessment_categories', 'schedules',
      'flashcard_decks', 'flashcards', 'card_logs', 'study_sessions',
      'photos', 'audio_recordings', 'youtube_videos', 'scanned_documents',
      'calendar_events', 'sync_queue',
    ];
    for (const table of tables) {
      try { await db.execAsync(`DELETE FROM ${table}`); } catch {}
    }
    try { await db.execAsync('VACUUM'); } catch {}
  }
}

export const databaseService = new DatabaseService();
