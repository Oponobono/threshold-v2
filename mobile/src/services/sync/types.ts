export type SyncState =
  | 'UNAUTHENTICATED'
  | 'LOGIN'
  | 'INITIAL_SYNC'
  | 'READY'
  | 'OFFLINE'
  | 'SYNCING'
  | 'PUSHING'
  | 'PULLING'
  | 'ERROR';

export type SyncPhase =
  | 'idle'
  | 'initial'
  | 'delta'
  | 'push'
  | 'pull';

export interface SyncProgress {
  phase: SyncPhase;
  current: number;
  total: number;
  label: string;
}

export interface SyncResult {
  success: boolean;
  phase: SyncPhase;
  entitiesSynced: number;
  errors: string[];
  durationMs: number;
}

export interface SyncEvent {
  type: 'state_change' | 'progress' | 'error' | 'complete';
  state?: SyncState;
  progress?: SyncProgress;
  result?: SyncResult;
  error?: string;
}

export type SyncListener = (event: SyncEvent) => void;
