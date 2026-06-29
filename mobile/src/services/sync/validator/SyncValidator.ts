import * as Crypto from 'expo-crypto';
import { databaseService } from '../../database/DatabaseService';
import { fetchWithFallback, parseJsonSafely } from '../../api/client';
import { getUserId } from '../../api/auth';
import type { EntityValidationResult, SyncValidationResult, EntityConfig } from './types';

const ENTITY_CONFIGS: EntityConfig[] = [
  { entityType: 'subjects', tableName: 'subjects', apiPath: '/subjects/${userId}', idField: 'id', userIdField: 'user_id' },
  { entityType: 'courses', tableName: 'courses', apiPath: '/courses', idField: 'id', userIdField: 'user_id' },
  { entityType: 'assessments', tableName: 'assessments', apiPath: '/assessments/user/${userId}', idField: 'id', userIdField: 'user_id' },
  { entityType: 'schedules', tableName: 'schedules', apiPath: '/schedules/user/${userId}', idField: 'id', userIdField: 'user_id' },
  { entityType: 'flashcard-decks', tableName: 'flashcard_decks', apiPath: '/flashcard-decks?user_id=${userId}', idField: 'id', userIdField: 'user_id' },
  { entityType: 'photos', tableName: 'photos', apiPath: '/gallery/${userId}', idField: 'id', userIdField: 'user_id', compareChecksum: false },
  { entityType: 'audio-recordings', tableName: 'audio_recordings', apiPath: '/audio-recordings/${userId}', idField: 'id', userIdField: 'user_id' },
  { entityType: 'calendar-events', tableName: 'calendar_events', apiPath: '/calendar/events?user_id=${userId}', idField: 'id', userIdField: 'user_id' },
];

// Fields to exclude from checksum computation (timestamps, metadata)
const SKIP_FIELDS = new Set([
  'created_at', 'updated_at', 'deleted_at', 'last_modified_by',
  'cloud_url', 'local_uri', 'thumbnail_uri',
]);

async function computeChecksum(records: any[]): Promise<string> {
  const sorted = [...records].sort((a, b) => {
    const idA = a.id ?? '';
    const idB = b.id ?? '';
    if (idA < idB) return -1;
    if (idA > idB) return 1;
    return 0;
  });

  const canonical = sorted.map(r => {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(r)) {
      if (!SKIP_FIELDS.has(key)) {
        clean[key] = value;
      }
    }
    return clean;
  });

  const json = JSON.stringify(canonical);
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, json);
}

function resolveApiPath(template: string, userId: string): string {
  return template.replace('${userId}', userId);
}

async function validateEntity(
  config: EntityConfig,
  userId: string,
): Promise<EntityValidationResult> {
  const result: EntityValidationResult = {
    entity: config.entityType,
    localCount: 0,
    remoteCount: 0,
    localChecksum: '',
    remoteChecksum: '',
    localVersion: 0,
    remoteVersion: 0,
    deletedLocalCount: 0,
    missingLocalIds: [],
    missingRemoteIds: [],
    status: 'OK',
  };

  try {
    const db = databaseService.getDb();
    const apiPath = resolveApiPath(config.apiPath, userId);

    // Fetch local data
    const localRows: any[] = await db.getAllAsync(
      `SELECT * FROM ${config.tableName} WHERE ${config.userIdField} = ? ORDER BY ${config.idField}`,
      userId,
    );

    // Fetch remote data
    const response = await fetchWithFallback(apiPath);
    let remoteRows: any[] = [];
    if (response.ok) {
      remoteRows = (await parseJsonSafely(response)) ?? [];
    } else {
      result.status = 'ERROR';
      return { ...result, status: 'ERROR' as const };
    }

    // Filter remote rows to only this user's records
    remoteRows = remoteRows.filter((r: any) => String(r[config.userIdField] ?? r.user_id) === userId);

    // Gallery endpoint mixes photos + scanned_documents; filter by item_type
    if (config.entityType === 'photos') {
      remoteRows = remoteRows.filter((r: any) => r.item_type === 'photo');
    }

    // Separate soft-deleted from active local records
    const activeLocal = localRows.filter((r: any) => !r.deleted_at);
    const deletedLocal = localRows.filter((r: any) => r.deleted_at);

    // Counts
    result.localCount = activeLocal.length;
    result.remoteCount = remoteRows.length;
    result.deletedLocalCount = deletedLocal.length;

    // Checksums (skip for entities where remote format differs from local)
    if (config.compareChecksum !== false) {
      result.localChecksum = await computeChecksum(activeLocal);
      result.remoteChecksum = await computeChecksum(remoteRows);
    }

    // Versions
    const localMaxVer = activeLocal.reduce((max: number, r: any) => Math.max(max, r.version_number ?? 0), 0);
    const remoteMaxVer = remoteRows.reduce((max: number, r: any) => Math.max(max, r.version_number ?? 0), 0);
    result.localVersion = localMaxVer;
    result.remoteVersion = remoteMaxVer;

    // Missing IDs
    const localIds = new Set(activeLocal.map((r: any) => String(r[config.idField])));
    const remoteIds = new Set(remoteRows.map((r: any) => String(r[config.idField])));
    result.missingLocalIds = [...remoteIds].filter(id => !localIds.has(id));
    result.missingRemoteIds = [...localIds].filter(id => !remoteIds.has(id));

    // Status
    if (result.missingLocalIds.length > 0 || result.missingRemoteIds.length > 0) {
      result.status = 'MISSING_IDS';
    }
    if (config.compareChecksum !== false && result.localChecksum !== result.remoteChecksum && result.status === 'OK') {
      result.status = 'CHECKSUM_MISMATCH';
    }
    if (result.localCount !== result.remoteCount && result.status === 'OK') {
      result.status = 'COUNT_MISMATCH';
    }
  } catch (error: any) {
    result.status = 'ERROR';
  }

  return result;
}

export async function validateAll(userId?: string): Promise<SyncValidationResult> {
  const startTime = Date.now();
  const uid = userId || await getUserId();
  const errors: string[] = [];

  if (!uid) {
    return {
      timestamp: new Date().toISOString(),
      results: [],
      overallStatus: 'FAIL',
      durationMs: Date.now() - startTime,
      errors: ['No user ID available'],
    };
  }

  const results: EntityValidationResult[] = [];
  for (const config of ENTITY_CONFIGS) {
    try {
      const entityResult = await validateEntity(config, uid);
      results.push(entityResult);
    } catch (error: any) {
      errors.push(`Error validating ${config.entityType}: ${error.message}`);
      results.push({
        entity: config.entityType,
        localCount: 0,
        remoteCount: 0,
        localChecksum: '',
        remoteChecksum: '',
        localVersion: 0,
        remoteVersion: 0,
        deletedLocalCount: 0,
        missingLocalIds: [],
        missingRemoteIds: [],
        status: 'ERROR',
      });
    }
  }

  const failed = results.filter(r => r.status !== 'OK');
  const overallStatus = failed.length === 0 ? 'PASS' : 'FAIL';

  return {
    timestamp: new Date().toISOString(),
    results,
    overallStatus,
    durationMs: Date.now() - startTime,
    errors,
  };
}

export async function validateEntityType(
  entityType: string,
  userId?: string,
): Promise<EntityValidationResult | null> {
  const config = ENTITY_CONFIGS.find(c => c.entityType === entityType);
  if (!config) return null;

  const uid = userId || await getUserId();
  if (!uid) return null;

  return validateEntity(config, uid);
}

export function formatValidationResult(result: SyncValidationResult): string {
  const lines: string[] = [];
  lines.push(`Sync Validation — ${result.timestamp}`);
  lines.push(`Status: ${result.overallStatus} (${result.durationMs}ms)`);
  lines.push('');

  for (const entity of result.results) {
    const icon = entity.status === 'OK' ? '✅' : '❌';
    lines.push(`${icon} ${entity.entity}`);
    lines.push(`   Local: ${entity.localCount} | Remote: ${entity.remoteCount} | Deleted: ${entity.deletedLocalCount}`);
    lines.push(`   Checksum: ${entity.localChecksum === entity.remoteChecksum ? 'OK' : 'MISMATCH'}`);
    lines.push(`   Version: ${entity.localVersion} / ${entity.remoteVersion}`);
    if (entity.missingLocalIds.length > 0) {
      lines.push(`   Missing locally (${entity.missingLocalIds.length}): ${entity.missingLocalIds.slice(0, 10).join(', ')}${entity.missingLocalIds.length > 10 ? '...' : ''}`);
    }
    if (entity.missingRemoteIds.length > 0) {
      lines.push(`   Missing remotely (${entity.missingRemoteIds.length}): ${entity.missingRemoteIds.slice(0, 10).join(', ')}${entity.missingRemoteIds.length > 10 ? '...' : ''}`);
    }
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.join(', ')}`);
  }

  return lines.join('\n');
}
