export enum SnapshotBuildReason {
  BOOT = 'BOOT',
  INITIAL_SYNC = 'INITIAL_SYNC',
  ENTITY_UPDATED = 'ENTITY_UPDATED',
  SUBJECT_UPDATED = 'SUBJECT_UPDATED',
  FLASHCARD_UPDATED = 'FLASHCARD_UPDATED',
  REVIEW_COMPLETED = 'REVIEW_COMPLETED',
  CACHE_INVALIDATED = 'CACHE_INVALIDATED',
  MANUAL_REFRESH = 'MANUAL_REFRESH',
}

export interface SnapshotTelemetry {
  reason: SnapshotBuildReason;
  snapshotId: number;
  cacheHit: boolean;
  durationMs: number;
  phaseTiming: SnapshotPhaseTiming;
  subjects: number;
  participants: number;
  flashcards: number;
  reviews: number;
  memoryEstimateKB: number;
  hash: string;
  timestamp: number;
}

export interface SnapshotPhaseTiming {
  repositoryReadMs: number;
  aggregationMs: number;
  snapshotCreateMs: number;
  freezeMs: number;
  cacheWriteMs: number;
}

export interface SnapshotTelemetryEntry {
  snapshotId: number;
  reason: SnapshotBuildReason;
  cacheHit: boolean;
  durationMs: number;
  phaseTiming: SnapshotPhaseTiming;
  subjects: number;
  flashcards: number;
  hash: string;
  timestamp: number;
}

export interface TelemetryAlert {
  snapshotId: number;
  severity: 'WARNING' | 'ERROR' | 'INFO';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}
