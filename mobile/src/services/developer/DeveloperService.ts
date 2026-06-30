import { syncManager } from '../sync/SyncManager';
import { syncJournal } from '../sync/SyncJournal';
import { syncDebugger } from '../sync/SyncDebugger';
import { databaseService } from '../database/DatabaseService';
import { validateAll } from '../sync/validator/SyncValidator';
import { validateAllAssets, formatAssetValidationResult } from '../sync/asset/AssetValidator';
import { runAllTests, formatScenarioReport } from '../sync/test';
import { networkManager } from '../network/NetworkManager';
import { assetSyncEngine } from '../sync/asset/AssetSyncEngine';
import { formatConsistencyReport } from '../sync/ConsistencyReport';
import type { ConsistencyReport } from '../sync/ConsistencyReport';

export interface DeveloperConsoleData {
  // Sync State
  syncState: string;
  syncStatus: string;
  syncError: string | null;
  syncDurationMs: number;
  network: string;
  lastSync: string;
  confidence: number;

  // Queue
  pending: number;
  retries: number;
  lastReduce: { original: number; reduced: number } | null;

  // Assets
  uploading: number;
  downloading: number;
  corrupted: number;
  missing: number;

  // Validator
  entitiesStatus: 'PASS' | 'FAIL' | 'NONE';
  assetsStatus: 'PASS' | 'FAIL' | 'NONE';

  // Journal
  recentSyncs: any[];

  // Test Harness
  testResults: string | null;

  // Timeline
  lastTraceId: string | null;

  // Consistency Report
  consistencyReport: ConsistencyReport | null;
}

class DeveloperService {
  async getData(): Promise<DeveloperConsoleData> {
    const recentSyncs = await syncJournal.getRecent(10);
    const lastSync = recentSyncs.length > 0 ? recentSyncs[0] : null;
    const lastSyncStr = lastSync
      ? `${Math.round((Date.now() - new Date(lastSync.started_at).getTime()) / 1000)}s ago`
      : 'never';

    const traceLogs = await syncDebugger.getRecentTraces(1);
    const lastTraceId = traceLogs.length > 0 ? traceLogs[0].trace_id : null;

    const queue = databaseService.getDb();
    let pending = 0;
    let retries = 0;
    try {
      const p: any = await queue.getFirstAsync(`SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed')`);
      pending = p?.count ?? 0;
      const r: any = await queue.getFirstAsync(`SELECT COUNT(*) as count FROM sync_queue WHERE retries > 0`);
      retries = r?.count ?? 0;
    } catch {}

    let corrupted = 0;
    let missing = 0;
    try {
      const c: any = await queue.getFirstAsync(`SELECT COUNT(*) as count FROM photos WHERE asset_state = 'CORRUPTED'`);
      const c2: any = await queue.getFirstAsync(`SELECT COUNT(*) as count FROM audio_recordings WHERE asset_state = 'CORRUPTED'`);
      const c3: any = await queue.getFirstAsync(`SELECT COUNT(*) as count FROM scanned_documents WHERE asset_state = 'CORRUPTED'`);
      corrupted = (c?.count ?? 0) + (c2?.count ?? 0) + (c3?.count ?? 0);
    } catch {}

    const confidence = this.calculateConfidence({ pending, retries, corrupted, missing });

    const consistencyReport = syncManager.lastConsistencyReport;
    const lastSyncStatus = syncManager.lastSyncStatus;

    return {
      syncState: syncManager.state === 'INITIAL_SYNC' || syncManager.state === 'PUSHING' || syncManager.state === 'PULLING' ? 'SYNCING' : syncManager.state,
      syncStatus: lastSyncStatus.lastSyncStatus ?? 'never',
      syncError: lastSyncStatus.lastSyncError,
      syncDurationMs: lastSyncStatus.lastSyncDurationMs,
      network: networkManager.isOnline ? 'ONLINE' : 'OFFLINE',
      lastSync: lastSyncStr,
      confidence,
      pending,
      retries,
      lastReduce: null,
      uploading: assetSyncEngine.uploader.queueLength,
      downloading: assetSyncEngine.downloader.queueLength,
      corrupted,
      missing,
      entitiesStatus: consistencyReport?.entities?.status ?? 'NONE',
      assetsStatus: consistencyReport?.assets?.status ?? 'NONE',
      recentSyncs,
      testResults: null,
      lastTraceId,
      consistencyReport,
    };
  }

  async runInitialSync(): Promise<void> {
    await syncManager.requestInitialSync(true);
  }

  getConsistencyReport(): string {
    if (!syncManager.lastConsistencyReport) return 'No report available yet. Run a sync first.';
    return formatConsistencyReport(syncManager.lastConsistencyReport);
  }

  async runDeltaSync(): Promise<void> {
    await syncManager.sync();
  }

  async runValidator(): Promise<{ entities: string; assets: string }> {
    const entityResult = await validateAll();
    const assetResult = await validateAllAssets();
    return {
      entities: entityResult.overallStatus,
      assets: assetResult.totalOk === assetResult.totalAssets ? 'PASS' : 'FAIL',
    };
  }

  async runTests(): Promise<string> {
    const report = await runAllTests();
    return formatScenarioReport(report);
  }

  async getTimeline(traceId: string): Promise<any[]> {
    const logs = await syncDebugger.getLogsFromDb(traceId);
    return logs.map(l => ({
      time: l.created_at,
      stage: l.stage,
      entityType: l.entity_type,
      entityId: l.entity_id,
      message: l.message,
      durationMs: l.duration_ms,
    }));
  }

  private calculateConfidence(opts: { pending: number; retries: number; corrupted: number; missing: number }): number {
    let score = 100;
    score -= opts.pending * 0.5;
    score -= opts.retries * 1;
    score -= opts.corrupted * 5;
    score -= opts.missing * 3;
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }
}

export const developerService = new DeveloperService();
