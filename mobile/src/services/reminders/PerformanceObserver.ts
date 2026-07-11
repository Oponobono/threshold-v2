export type StageName =
  | 'snapshot_builder.build'
  | 'engine.initialize'
  | 'engine.collect_sequences'
  | 'policy.evaluate'
  | 'interruption.resolve'
  | 'templates.enrich'
  | 'reconciler.sync'
  | 'provider.schedule';

export interface StageTiming {
  readonly stage: StageName;
  readonly durationMs: number;
  readonly entityCount?: number;
  readonly sequenceCount?: number;
  readonly scheduledCount?: number;
  readonly cancelledCount?: number;
}

export interface PerformanceObserver {
  record(stage: StageName, durationMs: number, meta?: Partial<Omit<StageTiming, 'stage' | 'durationMs'>>): void;
}

export class NullObserver implements PerformanceObserver {
  record(): void {}
}

export interface StageMetricsSummary {
  stage: StageName;
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export class MetricsCollector implements PerformanceObserver {
  private samples = new Map<StageName, number[]>();
  private metaSamples = new Map<StageName, Partial<Omit<StageTiming, 'stage' | 'durationMs'>>[]>();

  record(stage: StageName, durationMs: number, meta?: Partial<Omit<StageTiming, 'stage' | 'durationMs'>>): void {
    if (!this.samples.has(stage)) {
      this.samples.set(stage, []);
      this.metaSamples.set(stage, []);
    }
    this.samples.get(stage)!.push(durationMs);
    if (meta) {
      this.metaSamples.get(stage)!.push(meta);
    }
  }

  summarize(): StageMetricsSummary[] {
    const result: StageMetricsSummary[] = [];
    for (const [stage, durations] of this.samples) {
      if (durations.length === 0) continue;
      const sorted = [...durations].sort((a, b) => a - b);
      result.push({
        stage,
        count: durations.length,
        avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50Ms: sorted[Math.floor(sorted.length * 0.5)],
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        maxMs: sorted[sorted.length - 1],
      });
    }
    return result;
  }

  clear(): void {
    this.samples.clear();
    this.metaSamples.clear();
  }

  getTotalSamples(): number {
    let total = 0;
    for (const d of this.samples.values()) total += d.length;
    return total;
  }
}
