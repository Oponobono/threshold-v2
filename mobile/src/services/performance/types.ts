export interface PerformanceMetric {
  stage: string;
  durationMs: number;
  renderCount?: number;
  queryCount?: number;
  cacheHit?: boolean;
  timestamp: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: Record<string, {
    avg: number;
    p50: number;
    p95: number;
    max: number;
    count: number;
  }>;
}

export interface PerformanceBudget {
  stage: string;
  budgetMs: number;
  currentMs: number;
  exceeded: boolean;
}
