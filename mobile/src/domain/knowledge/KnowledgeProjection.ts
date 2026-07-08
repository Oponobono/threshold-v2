import { databaseService } from '../../services/database/DatabaseService';
import { getKnowledgeAggregation } from './query';
import { KnowledgeSnapshotBuilder } from './KnowledgeSnapshotBuilder';
import { snapshotTelemetry } from './SnapshotTelemetryService';
import { ConsoleTelemetryCollector, MmkvTelemetryCollector } from './SnapshotTelemetryCollector';
import type { KnowledgeSnapshot } from './types';
import type { KnowledgeProvider } from './KnowledgeProvider';
import type { SnapshotBuildReason } from './SnapshotTelemetryTypes';

let collectorsInitialized = false;

function ensureCollectors(): void {
  if (collectorsInitialized) return;
  collectorsInitialized = true;
  try {
    snapshotTelemetry.subscribe(new ConsoleTelemetryCollector());
  } catch {}
  try {
    snapshotTelemetry.subscribe(new MmkvTelemetryCollector());
  } catch {}
}

export class KnowledgeProjection implements KnowledgeProvider {
  buildSnapshot(userId: string, reason?: SnapshotBuildReason): Promise<KnowledgeSnapshot> {
    return this.buildSnapshotWithReason(userId, reason ?? 'BOOT' as SnapshotBuildReason);
  }

  async buildSnapshotWithReason(userId: string, reason: SnapshotBuildReason): Promise<KnowledgeSnapshot> {
    ensureCollectors();

    const ctx = snapshotTelemetry.begin(reason, userId);

    const readStart = Date.now();
    const db = databaseService.getDb();
    ctx.phaseTiming.repositoryReadMs = Date.now() - readStart;

    const aggStart = Date.now();
    const aggregation = await getKnowledgeAggregation(userId);
    ctx.phaseTiming.aggregationMs = Date.now() - aggStart;

    const buildStart = Date.now();
    const snapshot = new KnowledgeSnapshotBuilder(aggregation).build();
    ctx.phaseTiming.snapshotCreateMs = Date.now() - buildStart;

    const freezeStart = Date.now();
    Object.freeze(snapshot);
    ctx.phaseTiming.freezeMs = Date.now() - freezeStart;

    const cacheStart = Date.now();
    // cache write reservation
    ctx.phaseTiming.cacheWriteMs = Date.now() - cacheStart;

    ctx.finish(aggregation);

    return snapshot;
  }
}

// Dev-only: global trigger for post-sync measurement from console
if (__DEV__) {
  (globalThis as any).__triggerKnowledgeSnapshot = async (userId: string) => {
    const projection = new KnowledgeProjection();
    return projection.buildSnapshot(userId, SnapshotBuildReason.MANUAL_REFRESH);
  };
}
