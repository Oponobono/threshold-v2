import { databaseService } from '../../database/DatabaseService';
import { persistentLocalAssetStore, PersistentLocalAssetStore } from './PersistentLocalAssetStore';
import { syncDebugger } from '../SyncDebugger';
import { AssetMetadata, AssetState } from './types';

export interface AssetValidationEntry {
  entityType: string;
  assetId: string;
  filename: string;
  assetState: AssetState;
  /** true if the file exists on disk */
  fileExists: boolean;
  /** Expected size from SQLite */
  expectedSize: number | null;
  /** Actual size on disk */
  actualSize: number | null;
  /** Expected checksum from SQLite */
  expectedChecksum: string | null;
  /** Actual checksum computed from local file */
  actualChecksum: string | null;
  /** Check status */
  status: 'OK' | 'MISSING' | 'SIZE_MISMATCH' | 'CHECKSUM_MISMATCH' | 'ERROR';
  /** Error message if status is ERROR */
  error?: string;
}

export interface AssetValidationResult {
  timestamp: string;
  totalAssets: number;
  totalOk: number;
  totalMissing: number;
  totalSizeMismatch: number;
  totalChecksumMismatch: number;
  totalErrors: number;
  entries: AssetValidationEntry[];
  durationMs: number;
}

const ASSET_TABLES = [
  { entityType: 'photos', tableName: 'photos', idField: 'id' },
  { entityType: 'audio_recordings', tableName: 'audio_recordings', idField: 'id' },
  { entityType: 'scanned_documents', tableName: 'scanned_documents', idField: 'id' },
] as const;

async function validateAssetEntry(
  entityType: string,
  row: any,
): Promise<AssetValidationEntry> {
  const relativePath = PersistentLocalAssetStore.makePath(entityType, row.id, row.filename || 'file.bin');
  const fileExists = await persistentLocalAssetStore.exists(relativePath);

  let actualSize: number | null = null;
  let actualChecksum: string | null = null;

  if (fileExists) {
    actualSize = await persistentLocalAssetStore.getSize(relativePath);
    actualChecksum = await persistentLocalAssetStore.computeChecksum(relativePath);
  }

  const expectedSize = row.file_size ?? null;
  const expectedChecksum = row.checksum ?? null;

  let status: AssetValidationEntry['status'] = 'OK';

  if (!fileExists) {
    // Only flag missing if asset_state indicates it should exist
    if (row.asset_state === 'SYNCED' || row.asset_state === 'LOCAL_ONLY' || row.asset_state === 'TRANSFERRING') {
      status = 'MISSING';
    }
  } else {
    if (expectedSize != null && actualSize != null && actualSize !== expectedSize) {
      status = 'SIZE_MISMATCH';
    } else if (expectedChecksum && actualChecksum && actualChecksum !== expectedChecksum) {
      status = 'CHECKSUM_MISMATCH';
    }
  }

  return {
    entityType,
    assetId: row.id,
    filename: row.filename || 'unknown',
    assetState: row.asset_state,
    fileExists,
    expectedSize,
    actualSize,
    expectedChecksum,
    actualChecksum,
    status,
  };
}

export async function validateAllAssets(): Promise<AssetValidationResult> {
  const startTime = Date.now();
  const entries: AssetValidationEntry[] = [];
  const db = databaseService.getDb();

  for (const { entityType, tableName, idField } of ASSET_TABLES) {
    try {
      const rows: any[] = await db.getAllAsync(
        `SELECT * FROM ${tableName} WHERE deleted_at IS NULL ORDER BY ${idField}`,
      );

      for (const row of rows) {
        try {
          const entry = await validateAssetEntry(entityType, row);
          entries.push(entry);
        } catch (err: any) {
          entries.push({
            entityType,
            assetId: row[idField],
            filename: row.filename || 'unknown',
            assetState: row.asset_state,
            fileExists: false,
            expectedSize: null,
            actualSize: null,
            expectedChecksum: null,
            actualChecksum: null,
            status: 'ERROR',
            error: err.message,
          });
        }
      }
    } catch (err: any) {
      syncDebugger.logError('asset-validator', null, 'ERROR', `Failed to query ${tableName}`, err);
    }
  }

  const totalOk = entries.filter(e => e.status === 'OK').length;
  const totalMissing = entries.filter(e => e.status === 'MISSING').length;
  const totalSizeMismatch = entries.filter(e => e.status === 'SIZE_MISMATCH').length;
  const totalChecksumMismatch = entries.filter(e => e.status === 'CHECKSUM_MISMATCH').length;
  const totalErrors = entries.filter(e => e.status === 'ERROR').length;

  return {
    timestamp: new Date().toISOString(),
    totalAssets: entries.length,
    totalOk,
    totalMissing,
    totalSizeMismatch,
    totalChecksumMismatch,
    totalErrors,
    entries,
    durationMs: Date.now() - startTime,
  };
}

export function formatAssetValidationResult(result: AssetValidationResult): string {
  const lines: string[] = [];
  lines.push(`Asset Validation — ${result.timestamp}`);
  lines.push(`Status: ${result.totalOk}/${result.totalAssets} OK (${result.durationMs}ms)`);
  if (result.totalMissing > 0) lines.push(`  Missing files: ${result.totalMissing}`);
  if (result.totalSizeMismatch > 0) lines.push(`  Size mismatches: ${result.totalSizeMismatch}`);
  if (result.totalChecksumMismatch > 0) lines.push(`  Checksum mismatches: ${result.totalChecksumMismatch}`);
  if (result.totalErrors > 0) lines.push(`  Errors: ${result.totalErrors}`);
  lines.push('');

  for (const entry of result.entries) {
    if (entry.status === 'OK') continue;
    const icon = entry.status === 'MISSING' ? 'MISS' :
                 entry.status === 'CHECKSUM_MISMATCH' ? 'HASH' :
                 entry.status === 'SIZE_MISMATCH' ? 'SIZE' : 'ERR';
    lines.push(`[${icon}] ${entry.entityType}/${entry.assetId} (${entry.filename}) — ${entry.status}${entry.error ? ': ' + entry.error : ''}`);
  }

  return lines.join('\n');
}
