import { databaseService } from '../DatabaseService';

export interface SyncQueueItem {
  id?: number;
  entity_type: string;
  entity_id?: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  error?: string;
  created_at?: string;
  updated_at?: string;
}

export class SyncQueueRepository {
  async enqueue(item: Omit<SyncQueueItem, 'id' | 'status' | 'retries' | 'created_at' | 'updated_at'>): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(
      `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, status, retries)
       VALUES (?, ?, ?, ?, 'pending', 0)`,
      item.entity_type, item.entity_id ?? null, item.operation, item.payload ?? null
    );
  }

  async getPending(): Promise<SyncQueueItem[]> {
    const db = databaseService.getDb();
    return db.getAllAsync(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC`
    ) as Promise<SyncQueueItem[]>;
  }

  async markProcessing(id: number): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'processing', updated_at = datetime('now') WHERE id = ?`, id
    );
  }

  async markCompleted(id: number): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'completed', updated_at = datetime('now') WHERE id = ?`, id
    );
  }

  async markFailed(id: number, error: string): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'failed', retries = retries + 1, error = ?, updated_at = datetime('now') WHERE id = ?`,
      error, id
    );
  }

  async countPending(): Promise<number> {
    const db = databaseService.getDb();
    const row: any = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
    );
    return row?.count ?? 0;
  }

  async clearCompleted(): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(`DELETE FROM sync_queue WHERE status = 'completed'`);
  }

  async clearAll(): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(`DELETE FROM sync_queue`);
  }
}

export const syncQueueRepository = new SyncQueueRepository();
