import * as Crypto from 'expo-crypto';
import { databaseService } from '../../database/DatabaseService';
import type { EntityValidationResult, SyncValidationResult, EntityConfig } from './types';

const SKIP_FIELDS = new Set([
  'created_at', 'updated_at', 'deleted_at', 'last_modified_by',
  'cloud_url', 'local_uri', 'thumbnail_uri',
]);

const ENTITY_TABLES: { entityType: string; tableName: string; idField: string; userIdField: string }[] = [
  { entityType: 'subjects', tableName: 'subjects', idField: 'id', userIdField: 'user_id' },
  { entityType: 'courses', tableName: 'courses', idField: 'id', userIdField: 'user_id' },
  { entityType: 'assessments', tableName: 'assessments', idField: 'id', userIdField: 'user_id' },
  { entityType: 'schedules', tableName: 'schedules', idField: 'id', userIdField: 'user_id' },
  { entityType: 'flashcard-decks', tableName: 'flashcard_decks', idField: 'id', userIdField: 'user_id' },
  { entityType: 'photos', tableName: 'photos', idField: 'id', userIdField: 'user_id' },
  { entityType: 'audio-recordings', tableName: 'audio_recordings', idField: 'id', userIdField: 'user_id' },
  { entityType: 'calendar-events', tableName: 'calendar_events', idField: 'id', userIdField: 'user_id' },
  { entityType: 'scanned-documents', tableName: 'scanned_documents', idField: 'id', userIdField: 'user_id' },
];

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

async function validateEntity(
  config: { entityType: string; tableName: string; idField: string; userIdField: string },
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

    const localRows: any[] = await db.getAllAsync(
      `SELECT * FROM ${config.tableName} WHERE ${config.userIdField} = ? ORDER BY ${config.idField}`,
      userId,
    );

    const activeLocal = localRows.filter((r: any) => !r.deleted_at);
    const deletedLocal = localRows.filter((r: any) => r.deleted_at);

    result.localCount = activeLocal.length;
    result.deletedLocalCount = deletedLocal.length;
    result.localChecksum = await computeChecksum(activeLocal);

    const localMaxVer = activeLocal.reduce((max: number, r: any) => Math.max(max, r.version_number ?? 0), 0);
    result.localVersion = localMaxVer;

    if (result.localCount === 0) {
      result.status = 'EMPTY';
    }
  } catch (error: any) {
    result.status = 'ERROR';
  }

  return result;
}

export async function validateAll(userId?: string, entities?: string[]): Promise<SyncValidationResult> {
  const startTime = Date.now();
  const { getUserId } = await import('../../api/auth');
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

  const configs = entities
    ? ENTITY_TABLES.filter(c => entities.includes(c.entityType))
    : ENTITY_TABLES;

  if (configs.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      results: [],
      overallStatus: 'PASS',
      durationMs: Date.now() - startTime,
      errors: [],
    };
  }

  const results: EntityValidationResult[] = [];
  for (const config of configs) {
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

  const failed = results.filter(r => r.status !== 'OK' && r.status !== 'EMPTY');
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
  const config = ENTITY_TABLES.find(c => c.entityType === entityType);
  if (!config) return null;

  const { getUserId } = await import('../../api/auth');
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
    const icon = entity.status === 'OK' ? '✅' : entity.status === 'EMPTY' ? '⬜' : '❌';
    lines.push(`${icon} ${entity.entity}`);
    lines.push(`   Local: ${entity.localCount} | Deleted: ${entity.deletedLocalCount}`);
    lines.push(`   Checksum: ${entity.localChecksum.slice(0, 16)}...`);
    lines.push(`   Version: ${entity.localVersion}`);
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.join(', ')}`);
  }

  return lines.join('\n');
}