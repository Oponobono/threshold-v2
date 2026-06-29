import { databaseService } from '../database/DatabaseService';

export interface SyncJournalEntry {
  id?: number;
  sync_type: 'initial' | 'delta' | 'push' | 'pull';
  phase: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration_ms: number;
  entities_synced: number;
  bytes_downloaded: number;
  bytes_uploaded: number;
  conflicts: number;
  retries: number;
  errors: string;
  started_at: string;
  finished_at?: string;
}

class SyncJournal {
  private _currentId: number | null = null;
  private _startTime: number = 0;

  async startEntry(syncType: SyncJournalEntry['sync_type'], phase: string): Promise<number> {
    const db = databaseService.getDb();
    if (!db) return 0;
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `INSERT INTO sync_journal (sync_type, phase, status, duration_ms, started_at)
       VALUES (?, ?, 'running', 0, ?)`,
      syncType, phase, now
    );
    this._currentId = result?.lastInsertRowId ?? null;
    this._startTime = Date.now();
    return this._currentId ?? 0;
  }

  async finishEntry(params: {
    status: 'success' | 'error';
    entities_synced?: number;
    bytes_downloaded?: number;
    bytes_uploaded?: number;
    conflicts?: number;
    retries?: number;
    errors?: string[];
  }): Promise<void> {
    if (!this._currentId) return;
    const db = databaseService.getDb();
    if (!db) return;
    const durationMs = Date.now() - this._startTime;
    const finishedAt = new Date().toISOString();
    const errorsStr = params.errors?.join('; ') || '';
    await db.runAsync(
      `UPDATE sync_journal SET
        status = ?, duration_ms = ?, finished_at = ?,
        entities_synced = ?, bytes_downloaded = ?, bytes_uploaded = ?,
        conflicts = ?, retries = ?, errors = ?
       WHERE id = ?`,
      params.status, durationMs, finishedAt,
      params.entities_synced ?? 0, params.bytes_downloaded ?? 0, params.bytes_uploaded ?? 0,
      params.conflicts ?? 0, params.retries ?? 0, errorsStr,
      this._currentId
    );
    this._currentId = null;
  }

  async getRecent(limit = 20): Promise<SyncJournalEntry[]> {
    const db = databaseService.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      'SELECT * FROM sync_journal ORDER BY id DESC LIMIT ?', limit
    );
    return (rows as any[]).map(r => ({
      ...r,
      errors: r.errors || '',
    }));
  }
}

export const syncJournal = new SyncJournal();
