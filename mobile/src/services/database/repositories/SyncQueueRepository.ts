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
  trace_id?: string;
  created_at?: string;
  updated_at?: string;
}

export class SyncQueueRepository {
  async enqueue(item: Omit<SyncQueueItem, 'id' | 'status' | 'retries' | 'created_at' | 'updated_at'>): Promise<void> {
    const db = databaseService.getDb();

    // Deduplication: for UPDATE operations on the same entity, merge into the
    // existing pending/failed row instead of creating a new one. This prevents
    // unbounded queue growth when the same entity is updated many times offline.
    if (item.operation === 'UPDATE' && item.entity_id) {
      const existing: any = await db.getFirstAsync(
        `SELECT id FROM sync_queue
         WHERE entity_type = ? AND entity_id = ? AND operation = 'UPDATE'
           AND status IN ('pending', 'failed')
         ORDER BY id DESC LIMIT 1`,
        item.entity_type, item.entity_id
      );
      if (existing) {
        await db.runAsync(
          `UPDATE sync_queue
           SET payload = ?, status = 'pending', retries = 0, error = NULL, trace_id = ?, updated_at = datetime('now')
           WHERE id = ?`,
          item.payload ?? null, item.trace_id ?? null, existing.id
        );
        return;
      }
    }

    await db.runAsync(
      `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, status, retries, trace_id)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
      item.entity_type, item.entity_id ?? null, item.operation, item.payload ?? null, item.trace_id ?? null
    );
  }

  async getPendingOperations(entityType: string, entityId: string): Promise<SyncQueueItem[]> {
    const db = databaseService.getDb();
    return db.getAllAsync(
      `SELECT * FROM sync_queue WHERE entity_type = ? AND entity_id = ? AND status = 'pending'`,
      entityType, entityId
    ) as Promise<SyncQueueItem[]>;
  }

  async cancelPendingOperations(entityType: string, entityId: string): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(
      `DELETE FROM sync_queue WHERE entity_type = ? AND entity_id = ? AND status = 'pending'`,
      entityType, entityId
    );
  }

  async getPending(includeFailed = true): Promise<SyncQueueItem[]> {
    const db = databaseService.getDb();
    if (includeFailed) {
      return db.getAllAsync(
        `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY id ASC`
      ) as Promise<SyncQueueItem[]>;
    }
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

  // Delete on complete — avoids leaving thousands of stale 'completed' rows.
  async markCompleted(id: number): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, id);
  }

  async markCompletedBatch(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = databaseService.getDb();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `DELETE FROM sync_queue WHERE id IN (${placeholders})`,
      ...ids
    );
  }

  async markFailed(id: number, error: string): Promise<number> {
    const db = databaseService.getDb();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'failed', retries = retries + 1, error = ?, updated_at = datetime('now') WHERE id = ?`,
      error, id
    );
    const row: any = await db.getFirstAsync(`SELECT retries FROM sync_queue WHERE id = ?`, id);
    return row?.retries ?? 0;
  }

  async countPending(): Promise<number> {
    const db = databaseService.getDb();
    const row: any = await db.getFirstAsync(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed')`
    );
    return row?.count ?? 0;
  }

  async clearCompleted(): Promise<void> {
    // No-op: markCompleted now deletes immediately. Kept for backwards-compat.
    const db = databaseService.getDb();
    await db.runAsync(`DELETE FROM sync_queue WHERE status = 'completed'`);
  }

  async clearAll(): Promise<void> {
    const db = databaseService.getDb();
    await db.runAsync(`DELETE FROM sync_queue`);
  }
}

export const syncQueueRepository = new SyncQueueRepository();
