import type { ScenarioMetrics } from '../types';

export type StepStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface StepResult {
  step: string;
  status: StepStatus;
  durationMs: number;
  error?: string;
  metrics?: Partial<ScenarioMetrics>;
}

export interface AssetTestContext {
  /** Shared state across steps */
  state: Record<string, any>;
  /** Accumulated metrics */
  metrics: ScenarioMetrics;
  /** Step results */
  steps: StepResult[];
  /** Trace ID for the current test run */
  traceId: string;
}

export type StepFn = (ctx: AssetTestContext) => Promise<StepResult>;

export interface AssetTestStep {
  name: string;
  run: StepFn;
}

export type AssetType = 'photo' | 'audio-recording' | 'scanned-document';

export interface AssetInfo {
  id: string;
  entityType: AssetType;
  localPath: string;
  cloudUrl?: string;
  checksum?: string;
  fileSize?: number;
}
