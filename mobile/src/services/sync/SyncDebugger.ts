import { databaseService } from '../database/DatabaseService';

export type SyncStage =
  | 'SYNC_START'
  | 'SYNC_END'
  | 'QUEUE_ENQUEUE'
  | 'QUEUE_READ'
  | 'QUEUE_PROCESS'
  | 'QUEUE_COMPACT'
  | 'HTTP_REQUEST'
  | 'HTTP_RESPONSE'
  | 'CONTROLLER_WRITE'
  | 'REPOSITORY_WRITE'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'ENTITY_SAVE'
  | 'ENTITY_DELETE'
  | 'ERROR'
  | 'CONSISTENCY_CHECK';

export interface SyncDebugLog {
  id?: number;
  trace_id: string;
  operation_id: string | null;
  parent_trace_id: string | null;
  stage: SyncStage;
  entity_type?: string;
  entity_id?: string;
  message: string;
  data?: Record<string, unknown>;
  duration_ms?: number;
  created_at: string;
}

function shortId(): string {
  return Math.random().toString(36).substring(2, 6);
}

export function generateTraceId(type: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '').substring(0, 15);
  return `${type}_${ts}_${shortId()}`;
}

const MAX_MEMORY_LOGS = 2000;
const FLUSH_BATCH_SIZE = 20;

class SyncDebugger {
  private _logs: SyncDebugLog[] = [];
  private _pendingFlush: SyncDebugLog[] = [];
  private _flushTimer: ReturnType<typeof setTimeout> | null = null;
  private _operationCounters: Map<string, number> = new Map();
  private _stageTimers: Map<string, number> = new Map();

  beginSync(traceId: string, type: string): void {
    this._operationCounters.set(traceId, 0);
    this._logNow({
      trace_id: traceId,
      operation_id: null,
      parent_trace_id: null,
      stage: 'SYNC_START',
      message: `Sync started: ${type}`,
      data: { syncType: type },
      created_at: new Date().toISOString(),
    });
  }

  nextOperationId(traceId: string): string {
    const next = (this._operationCounters.get(traceId) ?? 0) + 1;
    this._operationCounters.set(traceId, next);
    return `op_${String(next).padStart(3, '0')}`;
  }

  endSync(traceId: string, result: { success: boolean; entitiesSynced: number; errors: string[]; durationMs: number }): void {
    this._logNow({
      trace_id: traceId,
      operation_id: null,
      parent_trace_id: null,
      stage: 'SYNC_END',
      message: `Sync finished: success=${result.success}, entities=${result.entitiesSynced}, errors=${result.errors.length}`,
      data: { ...result },
      duration_ms: result.durationMs,
      created_at: new Date().toISOString(),
    });
    this.flushNow();
  }

  log(
    traceId: string,
    operationId: string | null,
    parentTraceId: string | null,
    stage: SyncStage,
    message: string,
    data?: Record<string, unknown>,
    entityType?: string,
    entityId?: string,
    durationMs?: number,
  ): void {
    this._logNow({
      trace_id: traceId,
      operation_id: operationId,
      parent_trace_id: parentTraceId,
      stage,
      entity_type: entityType,
      entity_id: entityId,
      message,
      data,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
    });
  }

  logError(
    traceId: string,
    operationId: string | null,
    stage: SyncStage,
    message: string,
    error: unknown,
    entityType?: string,
    entityId?: string,
  ): void {
    const errMsg = error instanceof Error ? error.message : String(error);
    this._logNow({
      trace_id: traceId,
      operation_id: operationId,
      parent_trace_id: null,
      stage: 'ERROR',
      entity_type: entityType,
      entity_id: entityId,
      message: `${stage}: ${message} — ${errMsg}`,
      data: { originalStage: stage, error: errMsg },
      created_at: new Date().toISOString(),
    });
  }

  timeStart(traceId: string, timerKey: string): void {
    this._stageTimers.set(`${traceId}:${timerKey}`, Date.now());
  }

  timeEnd(
    traceId: string,
    timerKey: string,
    stage: SyncStage,
    message: string,
    data?: Record<string, unknown>,
    operationId?: string | null,
    entityType?: string,
    entityId?: string,
  ): number {
    const start = this._stageTimers.get(`${traceId}:${timerKey}`);
    if (!start) return 0;
    const durationMs = Date.now() - start;
    this._stageTimers.delete(`${traceId}:${timerKey}`);
    this.log(traceId, operationId ?? null, null, stage, message, { ...data, duration_ms: durationMs }, entityType, entityId, durationMs);
    return durationMs;
  }

  async time<T>(
    traceId: string,
    timerKey: string,
    stage: SyncStage,
    message: string,
    fn: () => Promise<T>,
    data?: Record<string, unknown>,
    operationId?: string | null,
    entityType?: string,
    entityId?: string,
  ): Promise<T> {
    this.timeStart(traceId, timerKey);
    try {
      const result = await fn();
      this.timeEnd(traceId, timerKey, stage, message, data, operationId, entityType, entityId);
      return result;
    } catch (err) {
      this.timeEnd(traceId, timerKey, stage, `${message} (failed)`, { ...data, error: err instanceof Error ? err.message : String(err) }, operationId, entityType, entityId);
      throw err;
    }
  }

  getLogs(traceId?: string): SyncDebugLog[] {
    if (traceId) {
      return this._logs.filter(l => l.trace_id === traceId);
    }
    return [...this._logs];
  }

  async getLogsFromDb(traceId: string): Promise<SyncDebugLog[]> {
    try {
      const db = databaseService.getDb();
      const rows = await db.getAllAsync(
        'SELECT * FROM sync_debug_logs WHERE trace_id = ? ORDER BY id ASC',
        traceId,
      );
      return rows as SyncDebugLog[];
    } catch {
      return [];
    }
  }

  async getRecentTraces(limit = 20): Promise<{ trace_id: string; stage: string; message: string; created_at: string }[]> {
    try {
      const db = databaseService.getDb();
      const rows = await db.getAllAsync(
        `SELECT trace_id, stage, message, created_at FROM sync_debug_logs
         WHERE stage = 'SYNC_START' OR stage = 'SYNC_END'
         ORDER BY id DESC LIMIT ?`,
        limit,
      );
      return rows as any[];
    } catch {
      return [];
    }
  }

  private _logNow(entry: SyncDebugLog): void {
    this._logs.push(entry);
    this._pendingFlush.push(entry);

    if (this._logs.length > MAX_MEMORY_LOGS) {
      this._logs.splice(0, this._logs.length - MAX_MEMORY_LOGS);
    }

    if (this._pendingFlush.length >= FLUSH_BATCH_SIZE) {
      this.flushNow();
    } else if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this.flushNow(), 5000);
    }
  }

  flushNow(): void {
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    if (this._pendingFlush.length === 0) return;

    const batch = this._pendingFlush.splice(0, FLUSH_BATCH_SIZE);
    this._insertBatch(batch).catch(() => {});
  }

  private async _insertBatch(batch: SyncDebugLog[]): Promise<void> {
    try {
      const db = databaseService.getDb();
      const stmt = await db.prepareAsync(
        `INSERT INTO sync_debug_logs (trace_id, operation_id, parent_trace_id, stage, entity_type, entity_id, message, data, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const log of batch) {
        await stmt.executeAsync(
          log.trace_id,
          log.operation_id,
          log.parent_trace_id,
          log.stage,
          log.entity_type ?? null,
          log.entity_id ?? null,
          log.message,
          log.data ? JSON.stringify(log.data) : null,
          log.duration_ms ?? null,
          log.created_at,
        );
      }
      await stmt.finalizeAsync();
    } catch (e) {
      console.warn('[SyncDebugger] Flush failed:', e);
    }
  }
}

export const syncDebugger = new SyncDebugger();
