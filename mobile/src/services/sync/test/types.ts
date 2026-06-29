export type ScenarioStatus = 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED';

export type FaultType = 'HTTP_500' | 'HTTP_429' | 'HTTP_TIMEOUT' | 'HTTP_TOKEN_EXPIRED' | 'HTTP_404' | 'SQLITE_BUSY' | 'PACKET_LOSS';

export interface FaultRule {
  faultType: FaultType;
  endpointPattern?: string;
  statusCode?: number;
  delayMs?: number;
  probability?: number;
}

export interface FaultInjectorConfig {
  enabled: boolean;
  rules: FaultRule[];
}

export interface ScenarioMetrics {
  durationMs: number;
  queueOriginal: number;
  queueReduced: number;
  uploaded: number;
  downloaded: number;
  validatorErrors: number;
  conflicts: number;
  retries: number;
  memoryMB: number;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  status: ScenarioStatus;
  error?: string;
  metrics: ScenarioMetrics;
  traceId?: string;
}

export interface SyncScenario {
  id: string;
  name: string;
  description: string;

  setup(): Promise<void>;
  execute(faults?: FaultRule[]): Promise<string>;
  validate(): Promise<ScenarioResult>;
  cleanup(): Promise<void>;
}

export interface ScenarioReport {
  timestamp: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDurationMs: number;
  results: ScenarioResult[];
  faultsUsed: FaultRule[];
}
