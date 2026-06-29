export type EntityStatus =
  | 'OK'
  | 'COUNT_MISMATCH'
  | 'CHECKSUM_MISMATCH'
  | 'VERSION_MISMATCH'
  | 'MISSING_IDS'
  | 'ERROR';

export interface EntityValidationResult {
  entity: string;
  localCount: number;
  remoteCount: number;
  localChecksum: string;
  remoteChecksum: string;
  localVersion: number;
  remoteVersion: number;
  deletedLocalCount: number;
  missingLocalIds: string[];
  missingRemoteIds: string[];
  status: EntityStatus;
}

export interface SyncValidationResult {
  timestamp: string;
  results: EntityValidationResult[];
  overallStatus: 'PASS' | 'FAIL';
  durationMs: number;
  errors: string[];
}

export interface EntityConfig {
  entityType: string;
  tableName: string;
  apiPath: string;
  idField: string;
  userIdField: string;
  compareChecksum?: boolean;
  skipFields?: string[];
}
