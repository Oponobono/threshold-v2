import { networkManager } from '../network/NetworkManager';
import { databaseService } from '../database/DatabaseService';
import { syncService } from '../database/SyncService';
import { fetchWithFallback } from '../api/client';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import { SyncState, SyncPhase, SyncProgress, SyncResult, SyncEvent, SyncListener } from './types';
import { EntitySynchronizer } from './EntitySynchronizer';
import { syncJournal } from './SyncJournal';
import { syncDebugger, generateTraceId } from './SyncDebugger';
import {
  UserSynchronizer,
  CourseSynchronizer,
  SubjectSynchronizer,
  AssessmentSynchronizer,
  ScheduleSynchronizer,
  FlashcardSynchronizer,
  CalendarEventSynchronizer,
  GradingPeriodSynchronizer,
  LmsAccountSynchronizer,
  ThresholdOverrideSynchronizer,
  AssessmentCategorySynchronizer,
  StudySessionSynchronizer,
  PhotoSynchronizer,
  AudioSynchronizer,
  DocumentSynchronizer,
} from './synchronizers';
import { assetSyncEngine } from './asset/AssetSyncEngine';
import { generateConsistencyReport } from './ConsistencyReport';
import type { ConsistencyReport } from './ConsistencyReport';

const SYNC_DEBOUNCE_MS = 2000;

interface SyncStatus {
  lastSyncTime: number | null;
  lastSyncStatus: 'success' | 'failed' | null;
  lastSyncError: string | null;
  lastSyncPhase: SyncPhase | null;
  lastSyncDurationMs: number;
}

class SyncManager {
  private _state: SyncState = 'UNAUTHENTICATED';
  private _listeners: Set<SyncListener> = new Set();
  private _unsubscribeNetwork: (() => void) | null = null;
  private _isSyncing = false;
  private _lastInitialSyncAt: number | null = null;
  private _lastSyncVersion: number = 0;
  private _pendingRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private _synchronizers: Map<string, EntitySynchronizer> = new Map();
  private _lastConsistencyReport: ConsistencyReport | null = null;
  private _lastSyncStatus: SyncStatus = {
    lastSyncTime: null,
    lastSyncStatus: null,
    lastSyncError: null,
    lastSyncPhase: null,
    lastSyncDurationMs: 0,
  };

  constructor() {
    this._registerDefaults();
  }

  private _registerDefaults(): void {
    this.registerSynchronizer(new UserSynchronizer());
    this.registerSynchronizer(new CourseSynchronizer());
    this.registerSynchronizer(new SubjectSynchronizer());
    this.registerSynchronizer(new AssessmentSynchronizer());
    this.registerSynchronizer(new ScheduleSynchronizer());
    this.registerSynchronizer(new FlashcardSynchronizer());
    this.registerSynchronizer(new CalendarEventSynchronizer());
    this.registerSynchronizer(new GradingPeriodSynchronizer());
    this.registerSynchronizer(new LmsAccountSynchronizer());
    this.registerSynchronizer(new ThresholdOverrideSynchronizer());
    this.registerSynchronizer(new AssessmentCategorySynchronizer());
    this.registerSynchronizer(new StudySessionSynchronizer());
    this.registerSynchronizer(new PhotoSynchronizer());
    this.registerSynchronizer(new AudioSynchronizer());
    this.registerSynchronizer(new DocumentSynchronizer());
  }

  registerSynchronizer(synchronizer: EntitySynchronizer): void {
    this._synchronizers.set(synchronizer.entityType, synchronizer);
  }

  get lastSyncStatus(): SyncStatus {
    return { ...this._lastSyncStatus };
  }

  get lastConsistencyReport(): ConsistencyReport | null {
    return this._lastConsistencyReport;
  }

  get state(): SyncState {
    return this._state;
  }

  subscribe(listener: SyncListener): () => void {
    this._listeners.add(listener);
    listener({ type: 'state_change', state: this._state });
    return () => this._listeners.delete(listener);
  }

  private _emit(event: SyncEvent): void {
    this._listeners.forEach(fn => {
      try { fn(event); } catch { /* ignore */ }
    });
  }

  private _setState(newState: SyncState): void {
    if (this._state === newState) return;
    const prev = this._state;
    this._state = newState;
    console.log(`[SyncManager] ${prev} → ${newState}`);
    this._emit({ type: 'state_change', state: newState });
  }

  private _emitProgress(phase: SyncPhase, current: number, total: number, label: string): void {
    this._emit({ type: 'progress', progress: { phase, current, total, label } });
  }

  private _startNetwork(): void {
    if (this._unsubscribeNetwork) return;

    this._unsubscribeNetwork = networkManager.subscribe(netState => {
      useConnectivityStore.getState().setOnline(netState.isOnline);

      if (this._state === 'OFFLINE' && netState.isOnline) {
        this._setState('READY');
        this._attemptSync();
      } else if (!netState.isOnline && this._state !== 'OFFLINE' && this._state !== 'UNAUTHENTICATED') {
        this._setState('OFFLINE');
      }
    });

    networkManager.start();
    console.log('[SyncManager] Started');
  }

  start(): void {
    this._startNetwork();
  }

  stop(): void {
    if (this._unsubscribeNetwork) {
      this._unsubscribeNetwork();
      this._unsubscribeNetwork = null;
    }
    networkManager.stop();
    if (this._pendingRetryTimeout) {
      clearTimeout(this._pendingRetryTimeout);
      this._pendingRetryTimeout = null;
    }
  }

  async login(): Promise<boolean> {
    if (this._state !== 'UNAUTHENTICATED') return true;
    this._setState('LOGIN');
    this._startNetwork();
    this._setState('READY');
    return true;
  }

  async requestInitialSync(force = false): Promise<SyncResult> {
    if (this._state === 'INITIAL_SYNC' || this._isSyncing) {
      return { success: false, phase: 'initial', entitiesSynced: 0, errors: ['Sync already in progress'], durationMs: 0 };
    }

    if (!force && this._lastInitialSyncAt !== null) {
      return { success: true, phase: 'initial', entitiesSynced: 0, errors: [], durationMs: 0 };
    }

    if (!networkManager.isOnline) {
      this._setState('OFFLINE');
      return { success: false, phase: 'initial', entitiesSynced: 0, errors: ['No network'], durationMs: 0 };
    }

    const traceId = generateTraceId('initial');
    syncDebugger.beginSync(traceId, 'initial');
    await syncJournal.startEntry('initial', 'initial');
    this._setState('INITIAL_SYNC');
    this._isSyncing = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let entitiesSynced = 0;

    try {
      this._emitProgress('initial', 0, 1, 'Downloading all data...');
      syncDebugger.timeStart(traceId, 'initial_http');
      syncDebugger.log(traceId, null, null, 'HTTP_REQUEST', 'Fetching initial sync data', { url: '/sync/initial' });

      const response = await fetchWithFallback('/sync/initial', {
        method: 'GET',
        headers: { 'X-Trace-Id': traceId },
      });

      syncDebugger.timeEnd(traceId, 'initial_http', 'HTTP_RESPONSE', `HTTP ${response.status}`, { status: response.status });

      if (!response.ok) {
        let errorBody = '';
        try { errorBody = await response.text(); } catch {}
        throw new Error(`Sync initial failed: HTTP ${response.status} — ${errorBody.slice(0, 200)}`);
      }

      const body = await response.json();
      const payload = body.payload || body;
      this._lastSyncVersion = body.syncVersion || 0;
      this._emitProgress('initial', 0, 1, 'Saving to local database...');
      syncDebugger.timeStart(traceId, 'initial_repo');
      syncDebugger.log(traceId, null, null, 'REPOSITORY_WRITE', 'Saving entities to SQLite', { entityCount: Object.keys(payload).length });

      await databaseService.runInTransaction(async () => {
        entitiesSynced = await this._saveAllEntities(payload);
      });
      syncDebugger.timeEnd(traceId, 'initial_repo', 'REPOSITORY_WRITE', `Saved ${entitiesSynced} entities to SQLite`, { entitiesSynced });

      this._lastInitialSyncAt = Date.now();
      this._setState('READY');

      const durationMs = Date.now() - startTime;
      const result: SyncResult = { success: true, phase: 'initial', entitiesSynced, errors, durationMs };
      this._lastSyncStatus = { lastSyncTime: Date.now(), lastSyncStatus: 'success', lastSyncError: null, lastSyncPhase: 'initial', lastSyncDurationMs: durationMs };
      syncDebugger.endSync(traceId, result);
      await syncJournal.finishEntry({ status: 'success', entities_synced: entitiesSynced, errors });
      this._emit({ type: 'complete', result });
      generateConsistencyReport({ syncType: 'initial', syncDurationMs: durationMs, syncSuccess: true }).then(r => {
        this._lastConsistencyReport = r;
        this._emit({ type: 'consistency', consistencyReport: r });
      }).catch(() => {});
      this.sync().catch(() => {});
      return result;

    } catch (err: any) {
      errors.push(err.message || 'Unknown error');
      console.error(`[SyncManager] Initial sync failed: ${err.message}`);
      this._setState('ERROR');
      const durationMs = Date.now() - startTime;
      const result: SyncResult = { success: false, phase: 'initial', entitiesSynced, errors, durationMs };
      this._lastSyncStatus = { lastSyncTime: Date.now(), lastSyncStatus: 'failed', lastSyncError: err.message || 'Unknown error', lastSyncPhase: 'initial', lastSyncDurationMs: durationMs };
      syncDebugger.logError(traceId, null, 'SYNC_END', 'Sync failed', err);
      await syncJournal.finishEntry({ status: 'error', entities_synced: entitiesSynced, errors });
      this._emit({ type: 'error', error: err.message, result });
      generateConsistencyReport({ syncType: 'initial', syncDurationMs: durationMs, syncSuccess: false }).then(r => {
        this._lastConsistencyReport = r;
        this._emit({ type: 'consistency', consistencyReport: r });
      }).catch(() => {});
      this._setState('READY');
      return result;
    } finally {
      this._isSyncing = false;
    }
  }

  async sync(): Promise<SyncResult> {
    if (this._isSyncing) {
      return { success: false, phase: 'push', entitiesSynced: 0, errors: ['Sync already in progress'], durationMs: 0 };
    }

    if (!networkManager.isOnline) {
      return { success: false, phase: 'push', entitiesSynced: 0, errors: ['No network'], durationMs: 0 };
    }

    const traceId = generateTraceId('delta');
    syncDebugger.beginSync(traceId, 'delta');
    await syncJournal.startEntry('delta', 'push');
    this._isSyncing = true;
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      this._setState('PUSHING');
      this._emitProgress('push', 0, 1, 'Pushing local changes...');
      syncDebugger.timeStart(traceId, 'push');
      syncDebugger.log(traceId, null, null, 'QUEUE_READ', 'Reading pending operations from queue');

      const pushResult = await syncService.sync(traceId, { force: false });

      syncDebugger.timeEnd(traceId, 'push', 'QUEUE_PROCESS', `Push result: ${pushResult.success} success, ${pushResult.failed} failed, ${pushResult.pending} pending`, { pushResult });

      await syncJournal.startEntry('delta', 'pull');
      this._setState('PULLING');
      this._emitProgress('pull', 0, 1, 'Pulling remote changes...');
      const pullErrors = await this._pullDeltaSync(traceId);

      errors.push(...pullErrors);
      const entitiesSynced = pushResult.success + (pullErrors.length === 0 ? 1 : 0);

      if (this._state === 'PUSHING' || this._state === 'PULLING') this._setState('READY');

      const durationMs = Date.now() - startTime;
      const success = errors.length === 0;
      const result: SyncResult = { success, phase: 'push', entitiesSynced, errors, durationMs };
      this._lastSyncStatus = { lastSyncTime: Date.now(), lastSyncStatus: success ? 'success' : 'failed', lastSyncError: errors.length > 0 ? errors[0] : null, lastSyncPhase: 'push', lastSyncDurationMs: durationMs };
      syncDebugger.endSync(traceId, result);
      await syncJournal.finishEntry({ status: success ? 'success' : 'error', entities_synced: entitiesSynced, errors });
      this._emit({ type: 'complete', result });
      generateConsistencyReport({ syncType: 'delta', syncDurationMs: durationMs, syncSuccess: result.success }).then(r => {
        this._lastConsistencyReport = r;
        this._emit({ type: 'consistency', consistencyReport: r });
      }).catch(() => {});
      return result;

    } catch (err: any) {
      errors.push(err.message || 'Unknown error');
      this._setState('ERROR');
      const durationMs = Date.now() - startTime;
      const result: SyncResult = { success: false, phase: 'push', entitiesSynced: 0, errors, durationMs };
      this._lastSyncStatus = { lastSyncTime: Date.now(), lastSyncStatus: 'failed', lastSyncError: err.message || 'Unknown error', lastSyncPhase: 'push', lastSyncDurationMs: durationMs };
      syncDebugger.logError(traceId, null, 'SYNC_END', 'Sync failed', err);
      await syncJournal.finishEntry({ status: 'error', errors: [err.message] });
      this._emit({ type: 'error', error: err.message, result });
      generateConsistencyReport({ syncType: 'delta', syncDurationMs: durationMs, syncSuccess: false }).then(r => {
        this._lastConsistencyReport = r;
        this._emit({ type: 'consistency', consistencyReport: r });
      }).catch(() => {});
      this._setState('READY');
      return result;
    } finally {
      this._isSyncing = false;
    }
  }

  private async _saveAllEntities(payload: Record<string, any>): Promise<number> {
    let count = 0;

    for (const [entityType, data] of Object.entries(payload)) {
      const synchronizer = this._synchronizers.get(entityType);
      if (!synchronizer) continue;

      if (entityType === 'user') {
        const items = Array.isArray(data) ? data : (data ? [data] : []);
        count += await synchronizer.saveAll(items);
      } else if (Array.isArray(data)) {
        count += await synchronizer.saveAll(data);
        // Schedule background downloads for assets
        if (entityType === 'photos' || entityType === 'audio_recordings' || entityType === 'scanned_documents') {
          assetSyncEngine.schedulePendingDownloads(entityType, data).catch(() => {});
        }
      }
    }

    return count;
  }

  private async _pullDeltaSync(traceId?: string): Promise<string[]> {
    const errors: string[] = [];

    try {
      const url = `/sync?version=${this._lastSyncVersion}`;
      if (traceId) { syncDebugger.timeStart(traceId, 'delta_http'); syncDebugger.log(traceId, null, null, 'HTTP_REQUEST', 'Fetching delta sync', { url, lastSyncVersion: this._lastSyncVersion }); }

      const response = await fetchWithFallback(url, {
        method: 'GET',
        headers: traceId ? { 'X-Trace-Id': traceId } : undefined,
      });

      if (traceId) syncDebugger.timeEnd(traceId, 'delta_http', 'HTTP_RESPONSE', `Delta HTTP ${response.status}`, { status: response.status });

      if (!response.ok) {
        errors.push(`Delta sync failed: HTTP ${response.status}`);
        return errors;
      }

      const body = await response.json();
      const remoteSyncVersion = body.syncVersion || this._lastSyncVersion;
      if (traceId) syncDebugger.log(traceId, null, null, 'HTTP_RESPONSE', `Delta received, new version: ${remoteSyncVersion}`, {
        updatedTables: Object.keys(body.updated || {}).join(','),
        deletedCount: body.deleted?.length ?? 0,
      });
      this._lastSyncVersion = remoteSyncVersion;

      if (body.updated) {
        if (traceId) { syncDebugger.timeStart(traceId, 'delta_repo'); syncDebugger.log(traceId, null, null, 'REPOSITORY_WRITE', 'Saving delta updates to SQLite', { entityCount: Object.keys(body.updated).length }); }
        await databaseService.runInTransaction(async () => {
          await this._saveAllEntities(body.updated as Record<string, any>);
        });
        if (traceId) syncDebugger.timeEnd(traceId, 'delta_repo', 'REPOSITORY_WRITE', 'Delta updates saved');
      }

      if (Array.isArray(body.deleted)) {
        if (traceId) syncDebugger.log(traceId, null, null, 'ENTITY_DELETE', `Processing ${body.deleted.length} deletes`, { count: body.deleted.length });
        for (const del of body.deleted) {
          const synchronizer = this._synchronizers.get(del.entityType);
          if (synchronizer) {
            try {
              await synchronizer.deleteItem(del.entityId);
              if (traceId) syncDebugger.log(traceId, null, null, 'ENTITY_DELETE', `Deleted ${del.entityType}/${del.entityId}`, { entityType: del.entityType, entityId: del.entityId });
            } catch (err: any) {
              errors.push(`Failed to delete ${del.entityType}/${del.entityId}: ${err.message}`);
              if (traceId) syncDebugger.logError(traceId, null, 'ENTITY_DELETE', `Failed to delete ${del.entityType}/${del.entityId}`, err);
            }
          }
        }
      }
    } catch (err: any) {
      errors.push(err.message || 'Delta sync error');
      if (traceId) syncDebugger.logError(traceId, null, 'HTTP_REQUEST', 'Delta sync error', err);
    }

    return errors;
  }

  async slowSync(): Promise<SyncResult> {
    const result = await this.sync();
    if (result.success) {
      try {
        await syncJournal.startEntry('delta', 'analytics');
        const { getLocalPredictions } = await import('../localMasteryService');
        await getLocalPredictions('').catch(() => null);
        await syncJournal.finishEntry({ status: 'success' });
      } catch (err: any) {
        await syncJournal.finishEntry({ status: 'error', errors: [err.message] });
      }
    }
    return result;
  }

  private _attemptSync(): void {
    if (this._pendingRetryTimeout) {
      clearTimeout(this._pendingRetryTimeout);
    }
    this._pendingRetryTimeout = setTimeout(() => {
      this.sync().catch(() => {});
    }, SYNC_DEBOUNCE_MS);
  }
}

export const syncManager = new SyncManager();
