export enum OperationType {
  Backup = 'backup',
  Restore = 'restore',
  Sync = 'sync',
  Import = 'import',
  Export = 'export',
  Download = 'download',
  Upload = 'upload',
  Indexing = 'indexing',
  OCR = 'ocr'
}

export enum OperationState {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled'
}

export enum OperationStage {
  Preparing = 'preparing',
  Collecting = 'collecting',
  Compressing = 'compressing',
  Uploading = 'uploading',
  Downloading = 'downloading',
  Processing = 'processing',
  Verifying = 'verifying',
  Finishing = 'finishing'
}

export const STAGE_ORDER: Record<OperationStage, number> = {
  [OperationStage.Preparing]: 0,
  [OperationStage.Collecting]: 1,
  [OperationStage.Compressing]: 2,
  [OperationStage.Uploading]: 3,
  [OperationStage.Downloading]: 3,
  [OperationStage.Processing]: 4,
  [OperationStage.Verifying]: 5,
  [OperationStage.Finishing]: 6
};

export interface OperationProgress {
  current: number;
  total: number;
  percentage: number;
  indeterminate: boolean;
}

export interface LongRunningOperation {
  id: string;
  type: OperationType;
  state: OperationState;
  stage?: OperationStage;
  progress?: OperationProgress;
  message?: string;
  startedAt: number;
  estimatedRemainingMs?: number;
  error?: string;
}

export type LROStartedEvent = { operation: LongRunningOperation };
export type LROProgressUpdatedEvent = { operation: LongRunningOperation };
export type LROCompletedEvent = { operation: LongRunningOperation; result?: any };
export type LROFailedEvent = { operation: LongRunningOperation; error: string | Error };
export type LROCancelledEvent = { operation: LongRunningOperation };

export function createLRO(type: OperationType): LongRunningOperation {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const shortId = Math.random().toString(36).substring(2, 8);
  return {
    id: `${type}-${timestamp}-${shortId}`,
    type,
    state: OperationState.Pending,
    startedAt: Date.now()
  };
}
