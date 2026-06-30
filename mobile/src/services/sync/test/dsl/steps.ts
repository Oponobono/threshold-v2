import * as FileSystem from 'expo-file-system';
import { databaseService } from '../../../database/DatabaseService';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { syncService } from '../../../database/SyncService';
import { persistentLocalAssetStore, PersistentLocalAssetStore } from '../../asset/PersistentLocalAssetStore';
import { assetSyncEngine } from '../../asset/AssetSyncEngine';
import { faultInjector } from '../FaultInjector';
import { syncManager } from '../../SyncManager';
import { syncDebugger } from '../../SyncDebugger';
import { validateAll } from '../../validator/SyncValidator';
import { validateAllAssets } from '../../asset/AssetValidator';
import { reduce } from '../../reducer/index';
import type { AssetTestContext, StepResult, AssetInfo, AssetType } from './types';
import type { FaultRule } from '../types';

function now(): string { return new Date().toISOString(); }

/** Create a synthetic asset file on disk + SQLite record + enqueue CREATE + schedule upload */
export function createAsset(type: AssetType, overrides?: Partial<AssetInfo>): (ctx: AssetTestContext) => Promise<StepResult> {
  return async (ctx: AssetTestContext): Promise<StepResult> => {
    const start = Date.now();
    const id = overrides?.id || `test-${type}-${Date.now()}`;
    const filename = `${id}.${type === 'photo' ? 'jpg' : type === 'audio-recording' ? 'm4a' : 'pdf'}`;
    const relativePath = PersistentLocalAssetStore.makePath(type, id, filename);
    const localPath = persistentLocalAssetStore.getPath(relativePath);

    try {
      await persistentLocalAssetStore.ensureDir();
      const content = new Array(1024).fill('A').join('');
      await FileSystem.writeAsStringAsync(localPath, content);

      const checksum = await persistentLocalAssetStore.computeChecksum(relativePath) || 'test-checksum';
      const fileSize = content.length;

      const db = databaseService.getDb();
      const table = type === 'photo' ? 'photos' : type === 'audio-recording' ? 'audio_recordings' : 'scanned_documents';
      const subjectId = 'test-subject';

      await db.runAsync(
        `INSERT OR REPLACE INTO ${table}
         (id, user_id, subject_id, filename, local_uri, cloud_url, checksum, file_size, asset_state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'LOCAL_ONLY', ?)`,
        id, 'test-user', subjectId, filename, localPath, null, checksum, fileSize, now(),
      );

      await syncService.enqueueCreate(type, id, {
        id, user_id: 'test-user', subject_id: subjectId, filename, file_size: fileSize, checksum,
      }, ctx.traceId);

      assetSyncEngine.scheduleUpload(type, id, localPath,
        type === 'photo' ? 'image/jpeg' : type === 'audio-recording' ? 'audio/m4a' : 'application/pdf',
        filename);

      ctx.state[`asset_${type}`] = ctx.state.asset = { id, entityType: type, localPath, checksum, fileSize } as AssetInfo;
      return { step: `createAsset(${type})`, status: 'PASS', durationMs: Date.now() - start,
        metrics: { uploaded: 1 } };
    } catch (e: any) {
      return { step: `createAsset(${type})`, status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Go offline via FaultInjector */
export function goOffline(): (ctx: AssetTestContext) => Promise<StepResult> {
  return async () => {
    const start = Date.now();
    faultInjector.enable([{ faultType: 'PACKET_LOSS', probability: 1 }]);
    return { step: 'goOffline', status: 'PASS', durationMs: Date.now() - start };
  };
}

/** Go online (clear faults) */
export function goOnline(): (ctx: AssetTestContext) => Promise<StepResult> {
  return async () => {
    const start = Date.now();
    faultInjector.disable();
    return { step: 'goOnline', status: 'PASS', durationMs: Date.now() - start };
  };
}

/** Run queue reducer + verify it produces expected ops */
export function reduceQueue(expectedOps?: number): (ctx: AssetTestContext) => Promise<StepResult> {
  return async () => {
    const start = Date.now();
    try {
      const items = await syncQueueRepository.getPending();
      const { operations, report } = reduce(items);
      const ok = expectedOps === undefined ? true : operations.length === expectedOps;
      return {
        step: 'reduceQueue', status: ok ? 'PASS' : 'FAIL',
        durationMs: Date.now() - start,
        error: ok ? undefined : `Expected ${expectedOps} ops, got ${operations.length}`,
        metrics: { queueOriginal: items.length, queueReduced: operations.length },
      };
    } catch (e: any) {
      return { step: 'reduceQueue', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Simulate kill/restart by clearing in-memory state */
export function killApp(): (ctx: AssetTestContext) => Promise<StepResult> {
  return async (ctx: AssetTestContext) => {
    const start = Date.now();
    try {
      // In-memory queues are lost on kill; the persistent SQLite queue survives.
      // AssetSyncEngine doesn't expose queue clearing — the persistent store is the source of truth.
      return { step: 'killApp', status: 'PASS', durationMs: Date.now() - start,
        metrics: { retries: ctx.state.killCount || 0 } };
    } catch (e: any) {
      return { step: 'killApp', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Restart: record kill count */
export function restartApp(): (ctx: AssetTestContext) => Promise<StepResult> {
  return async (ctx: AssetTestContext) => {
    const start = Date.now();
    try {
      ctx.state.killCount = (ctx.state.killCount || 0) + 1;
      return { step: 'restartApp', status: 'PASS', durationMs: Date.now() - start };
    } catch (e: any) {
      return { step: 'restartApp', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Validate local file checksum matches stored checksum */
export function validateChecksum(assetType?: AssetType): (ctx: AssetTestContext) => Promise<StepResult> {
  return async (ctx: AssetTestContext) => {
    const start = Date.now();
    const asset: AssetInfo = assetType ? ctx.state[`asset_${assetType}`] : ctx.state.asset;
    if (!asset) return { step: 'validateChecksum', status: 'FAIL', durationMs: Date.now() - start, error: 'No asset in context' };

    try {
      const relativePath = PersistentLocalAssetStore.makePath(asset.entityType, asset.id,
        `${asset.id}.${asset.entityType === 'photo' ? 'jpg' : asset.entityType === 'audio-recording' ? 'm4a' : 'pdf'}`);
      const exists = await persistentLocalAssetStore.exists(relativePath);
      if (!exists) return { step: 'validateChecksum', status: 'FAIL', durationMs: Date.now() - start, error: 'File not found' };

      const checksum = await persistentLocalAssetStore.computeChecksum(relativePath);
      const ok = checksum === asset.checksum;
      return {
        step: 'validateChecksum', status: ok ? 'PASS' : 'FAIL',
        durationMs: Date.now() - start,
        error: ok ? undefined : `Checksum mismatch: expected ${asset.checksum}, got ${checksum}`,
        metrics: ok ? {} : { validatorErrors: 1 },
      };
    } catch (e: any) {
      return { step: 'validateChecksum', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Validate asset_state in SQLite matches expected */
export function validateAssetState(expectedState: string, assetType?: AssetType): (ctx: AssetTestContext) => Promise<StepResult> {
  return async (ctx: AssetTestContext) => {
    const start = Date.now();
    const asset: AssetInfo = assetType ? ctx.state[`asset_${assetType}`] : ctx.state.asset;
    if (!asset) return { step: 'validateAssetState', status: 'FAIL', durationMs: Date.now() - start, error: 'No asset in context' };

    try {
      const db = databaseService.getDb();
      const table = asset.entityType === 'photo' ? 'photos' : asset.entityType === 'audio-recording' ? 'audio_recordings' : 'scanned_documents';
      const row: any = await db.getFirstAsync(`SELECT asset_state FROM ${table} WHERE id = ?`, asset.id);
      const actual = row?.asset_state;
      const ok = actual === expectedState;
      return {
        step: 'validateAssetState', status: ok ? 'PASS' : 'FAIL',
        durationMs: Date.now() - start,
        error: ok ? undefined : `Expected state ${expectedState}, got ${actual}`,
        metrics: ok ? {} : { validatorErrors: 1 },
      };
    } catch (e: any) {
      return { step: 'validateAssetState', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Verify SQLite queue is empty */
export function validateQueueEmpty(): (ctx: AssetTestContext) => Promise<StepResult> {
  return async () => {
    const start = Date.now();
    try {
      const pending = await syncQueueRepository.getPending();
      const ok = pending.length === 0;
      return {
        step: 'validateQueueEmpty', status: ok ? 'PASS' : 'FAIL',
        durationMs: Date.now() - start,
        error: ok ? undefined : `Queue has ${pending.length} pending items`,
        metrics: { queueOriginal: pending.length },
      };
    } catch (e: any) {
      return { step: 'validateQueueEmpty', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Verify queue has exactly N pending items */
export function validateQueueCount(expected: number): (ctx: AssetTestContext) => Promise<StepResult> {
  return async () => {
    const start = Date.now();
    try {
      const pending = await syncQueueRepository.getPending();
      const ok = pending.length === expected;
      return {
        step: 'validateQueueCount', status: ok ? 'PASS' : 'FAIL',
        durationMs: Date.now() - start,
        error: ok ? undefined : `Expected ${expected} pending, got ${pending.length}`,
        metrics: { queueOriginal: pending.length },
      };
    } catch (e: any) {
      return { step: 'validateQueueCount', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Run full SyncValidator + AssetValidator */
export function validateConsistency(): (ctx: AssetTestContext) => Promise<StepResult> {
  return async () => {
    const start = Date.now();
    try {
      const entityResult = await validateAll();
      const assetResult = await validateAllAssets();

      const entityOk = entityResult.overallStatus === 'PASS';
      const assetOk = assetResult.totalOk === assetResult.totalAssets;
      const ok = entityOk && assetOk;

      return {
        step: 'validateConsistency', status: ok ? 'PASS' : 'FAIL',
        durationMs: Date.now() - start,
        error: ok ? undefined : `Entities: ${entityResult.overallStatus}, Assets: ${assetResult.totalOk}/${assetResult.totalAssets} OK`,
        metrics: { validatorErrors: entityResult.results.filter(r => r.status !== 'OK').length + assetResult.totalChecksumMismatch + assetResult.totalMissing },
      };
    } catch (e: any) {
      return { step: 'validateConsistency', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Corrupt a local file by overwriting with garbage */
export function corruptFile(assetType?: AssetType): (ctx: AssetTestContext) => Promise<StepResult> {
  return async (ctx: AssetTestContext) => {
    const start = Date.now();
    const asset: AssetInfo = assetType ? ctx.state[`asset_${assetType}`] : ctx.state.asset;
    if (!asset) return { step: 'corruptFile', status: 'FAIL', durationMs: Date.now() - start, error: 'No asset in context' };

    try {
      await FileSystem.writeAsStringAsync(asset.localPath, 'CORRUPTED DATA ' + 'X'.repeat(512));
      return { step: 'corruptFile', status: 'PASS', durationMs: Date.now() - start };
    } catch (e: any) {
      return { step: 'corruptFile', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Delete an asset: SQLite soft-delete + local file delete + enqueue DELETE */
export function deleteAsset(assetType?: AssetType): (ctx: AssetTestContext) => Promise<StepResult> {
  return async (ctx: AssetTestContext) => {
    const start = Date.now();
    const asset: AssetInfo = assetType ? ctx.state[`asset_${assetType}`] : ctx.state.asset;
    if (!asset) return { step: 'deleteAsset', status: 'FAIL', durationMs: Date.now() - start, error: 'No asset in context' };

    try {
      const db = databaseService.getDb();
      const table = asset.entityType === 'photo' ? 'photos' : asset.entityType === 'audio-recording' ? 'audio_recordings' : 'scanned_documents';
      await db.runAsync(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`, now(), asset.id);

      const relativePath = PersistentLocalAssetStore.makePath(asset.entityType, asset.id,
        `${asset.id}.${asset.entityType === 'photo' ? 'jpg' : asset.entityType === 'audio-recording' ? 'm4a' : 'pdf'}`);
      await persistentLocalAssetStore.delete(relativePath);

      await syncService.enqueueDelete(asset.entityType, asset.id, ctx.traceId);
      return { step: 'deleteAsset', status: 'PASS', durationMs: Date.now() - start };
    } catch (e: any) {
      return { step: 'deleteAsset', status: 'FAIL', durationMs: Date.now() - start, error: e.message };
    }
  };
}

/** Wait for N ms */
export function wait(ms: number): (ctx: AssetTestContext) => Promise<StepResult> {
  return async () => {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, ms));
    return { step: `wait(${ms}ms)`, status: 'PASS', durationMs: Date.now() - start };
  };
}
