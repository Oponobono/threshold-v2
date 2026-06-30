import { validateAll } from './validator/SyncValidator';
import type { SyncValidationResult } from './validator/types';
import { validateAllAssets } from './asset/AssetValidator';
import type { AssetValidationResult } from './asset/AssetValidator';
import { syncJournal } from './SyncJournal';
import type { SyncJournalEntry } from './SyncJournal';
import { syncDebugger } from './SyncDebugger';
import { databaseService } from '../database/DatabaseService';
import { assetSyncEngine } from './asset/AssetSyncEngine';

export interface ConsistencyReport {
  timestamp: string;
  traceId: string | null;

  syncType: 'initial' | 'delta' | null;
  syncDurationMs: number;
  syncSuccess: boolean;

  entities: {
    status: 'PASS' | 'FAIL' | 'NONE';
    totalChecked: number;
    failed: number;
    results: SyncValidationResult | null;
  };

  assets: {
    status: 'PASS' | 'FAIL' | 'NONE';
    total: number;
    ok: number;
    missing: number;
    corrupted: number;
    errors: number;
    results: AssetValidationResult | null;
  };

  queue: {
    pending: number;
    retries: number;
    queueReduction: { original: number; reduced: number } | null;
  };

  journal: {
    lastSync: SyncJournalEntry | null;
    recentEntries: SyncJournalEntry[];
  };

  confidence: {
    score: number;
    breakdown: string;
  };

  debugEvents: number;
}

async function getQueueMetrics() {
  let pending = 0;
  let retries = 0;
  try {
    const db = databaseService.getDb();
    if (db) {
      const p: any = await db.getFirstAsync(`SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed')`);
      pending = p?.count ?? 0;
      const r: any = await db.getFirstAsync(`SELECT COUNT(*) as count FROM sync_queue WHERE retries > 0`);
      retries = r?.count ?? 0;
    }
  } catch {}
  return { pending, retries };
}

async function getCorruptedCount(): Promise<number> {
  let count = 0;
  try {
    const db = databaseService.getDb();
    if (db) {
      for (const table of ['photos', 'audio_recordings', 'scanned_documents']) {
        const c: any = await db.getFirstAsync(`SELECT COUNT(*) as count FROM ${table} WHERE deleted_at IS NULL AND asset_state = 'CORRUPTED'`);
        count += c?.count ?? 0;
      }
    }
  } catch {}
  return count;
}

function calculateConfidence(opts: { pending: number; retries: number; corrupted: number; missing: number }): { score: number; breakdown: string } {
  const parts: string[] = [];
  let score = 100;
  if (opts.pending > 0) { const d = opts.pending * 0.5; score -= d; parts.push(`-${d} pending`); }
  if (opts.retries > 0) { score -= opts.retries; parts.push(`-${opts.retries} retries`); }
  if (opts.corrupted > 0) { const d = opts.corrupted * 5; score -= d; parts.push(`-${d} corrupted`); }
  if (opts.missing > 0) { const d = opts.missing * 3; score -= d; parts.push(`-${d} missing`); }
  const finalScore = Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  const breakdown = parts.length > 0 ? `100 → ${finalScore}: ${parts.join(', ')}` : '100: no deductions';
  return { score: finalScore, breakdown };
}

export async function generateConsistencyReport(opts?: {
  syncType?: 'initial' | 'delta';
  syncDurationMs?: number;
  syncSuccess?: boolean;
  queueReduction?: { original: number; reduced: number } | null;
}): Promise<ConsistencyReport> {
  const startTime = Date.now();

  const [entityResult, assetResult, journalEntries, queueMetrics, corruptedCount, traceLogs] = await Promise.all([
    validateAll().catch(() => null),
    validateAllAssets().catch(() => null),
    syncJournal.getRecent(5),
    getQueueMetrics(),
    getCorruptedCount(),
    syncDebugger.getRecentTraces(1),
  ]);

  const lastSync = journalEntries.length > 0 ? journalEntries[0] : null;
  const lastTraceId = traceLogs.length > 0 ? traceLogs[0].trace_id : null;

  const debugEventsCount = lastTraceId
    ? (await syncDebugger.getLogsFromDb(lastTraceId).catch(() => [])).length
    : 0;

  const assetCount = assetResult?.totalAssets ?? 0;
  const assetOk = assetResult?.totalOk ?? 0;
  const assetMissing = assetResult?.totalMissing ?? 0;

  const assetCorruptedInResult = assetResult?.entries?.filter(e => e.status === 'CHECKSUM_MISMATCH').length ?? 0;
  const totalCorrupted = Math.max(corruptedCount, assetCorruptedInResult);

  const entityFailureCount = entityResult?.results?.filter(r => r.status !== 'OK').length ?? 0;

  const confidence = calculateConfidence({
    pending: queueMetrics.pending,
    retries: queueMetrics.retries,
    corrupted: totalCorrupted,
    missing: assetMissing,
  });

  return {
    timestamp: new Date().toISOString(),
    traceId: lastTraceId,
    syncType: opts?.syncType ?? null,
    syncDurationMs: opts?.syncDurationMs ?? 0,
    syncSuccess: opts?.syncSuccess ?? false,

    entities: {
      status: entityResult?.overallStatus ?? 'NONE',
      totalChecked: entityResult?.results?.length ?? 0,
      failed: entityFailureCount,
      results: entityResult,
    },

    assets: {
      status: assetResult && assetResult.totalOk === assetResult.totalAssets ? 'PASS' : assetResult ? 'FAIL' : 'NONE',
      total: assetCount,
      ok: assetOk,
      missing: assetMissing,
      corrupted: assetCorruptedInResult,
      errors: assetResult?.totalErrors ?? 0,
      results: assetResult,
    },

    queue: {
      pending: queueMetrics.pending,
      retries: queueMetrics.retries,
      queueReduction: opts?.queueReduction ?? null,
    },

    journal: {
      lastSync,
      recentEntries: journalEntries,
    },

    confidence,
    debugEvents: debugEventsCount,
  };
}

export function formatConsistencyReport(report: ConsistencyReport): string {
  const lines: string[] = [];
  const sep = '─'.repeat(50);
  lines.push(sep);
  lines.push(`CONSISTENCY REPORT — ${report.timestamp}`);
  lines.push(`TraceId: ${report.traceId ?? 'N/A'}`);
  lines.push(`Sync: ${report.syncType ?? 'manual'} | ${report.syncSuccess ? 'OK' : 'FAIL'} | ${report.syncDurationMs}ms`);
  lines.push(sep);

  lines.push(`Entities: ${report.entities.status} (${report.entities.totalChecked} checked, ${report.entities.failed} failed)`);
  lines.push(`Assets:   ${report.assets.status} (${report.assets.ok}/${report.assets.total} OK, ${report.assets.missing} missing, ${report.assets.corrupted} corrupted)`);
  lines.push(`Queue:    ${report.queue.pending} pending, ${report.queue.retries} retries${report.queue.queueReduction ? ` | last reduce: ${report.queue.queueReduction.original}→${report.queue.queueReduction.reduced}` : ''}`);
  lines.push(`Confidence: ${report.confidence.score}% — ${report.confidence.breakdown}`);
  lines.push(`Debug events: ${report.debugEvents}`);
  lines.push(sep);

  if (report.entities.results) {
    for (const entity of report.entities.results.results) {
      const icon = entity.status === 'OK' ? 'OK' : 'FAIL';
      lines.push(`  ${icon} ${entity.entity} local=${entity.localCount} remote=${entity.remoteCount} ver=${entity.localVersion}`);
    }
  }

  if (report.assets.results && (report.assets.missing > 0 || report.assets.corrupted > 0 || report.assets.errors > 0)) {
    lines.push(sep);
    lines.push('Asset Issues:');
    for (const entry of report.assets.results.entries) {
      if (entry.status !== 'OK') {
        lines.push(`  [${entry.status}] ${entry.entityType}/${entry.assetId}`);
      }
    }
  }

  if (report.journal.lastSync) {
    lines.push(sep);
    const j = report.journal.lastSync;
    lines.push(`Last journal: #${j.id} ${j.sync_type}/${j.status} ${j.duration_ms}ms entities=${j.entities_synced} conflicts=${j.conflicts}`);
  }

  return lines.join('\n');
}
