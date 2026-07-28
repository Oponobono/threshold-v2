import type { PerformanceMetric, PerformanceReport } from './types';

const BUDGETS: Record<string, number> = {
  'dashboard.mount': 200,
  'dashboard.focus': 5,
  'subjects.mount': 3000,
  'subjects.focus': 10,
  'knowledge.build': 100,
  'herocard.render': 16,
  'sqlite.query': 50,
  'transition.tab': 100,
};

class PerformanceDiagnostics {
  private metrics: PerformanceMetric[] = [];
  private renderCounts = new Map<string, number>();
  private enabled: boolean;

  constructor(enabled?: boolean) {
    this.enabled = enabled ?? (typeof __DEV__ !== 'undefined' ? __DEV__ : false);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  measure<T>(stage: string, fn: () => T): T {
    if (typeof __DEV__ === 'undefined' || !__DEV__ || !this.enabled) return fn();

    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    this.metrics.push({
      stage,
      durationMs: duration,
      timestamp: Date.now(),
    });

    const budget = BUDGETS[stage];
    if (budget && duration > budget) {
      console.warn(`[PERF] ${stage} excedió presupuesto: ${duration.toFixed(2)}ms > ${budget}ms`);
    }

    return result;
  }

  async measureAsync<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    if (typeof __DEV__ === 'undefined' || !__DEV__ || !this.enabled) return fn();

    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.metrics.push({
      stage,
      durationMs: duration,
      timestamp: Date.now(),
    });

    const budget = BUDGETS[stage];
    if (budget && duration > budget) {
      console.warn(`[PERF] ${stage} excedió presupuesto: ${duration.toFixed(2)}ms > ${budget}ms`);
    }

    return result;
  }

  trackRender(componentName: string): void {
    if (typeof __DEV__ === 'undefined' || !__DEV__ || !this.enabled) return;
    this.renderCounts.set(
      componentName,
      (this.renderCounts.get(componentName) ?? 0) + 1
    );
  }

  getRenderCount(componentName: string): number {
    return this.renderCounts.get(componentName) ?? 0;
  }

  resetRenderCounts(): void {
    this.renderCounts.clear();
  }

  trackNavigation(stage: string, startTime: number): void {
    if (typeof __DEV__ === 'undefined' || !__DEV__ || !this.enabled) return;
    this.metrics.push({
      stage,
      durationMs: performance.now() - startTime,
      timestamp: Date.now(),
    });
  }

  summarize(): PerformanceReport {
    const byStage = new Map<string, number[]>();

    for (const m of this.metrics) {
      const list = byStage.get(m.stage) ?? [];
      list.push(m.durationMs);
      byStage.set(m.stage, list);
    }

    const summary: PerformanceReport['summary'] = {};

    for (const [stage, durations] of byStage) {
      const sorted = [...durations].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      summary[stage] = {
        avg: sum / sorted.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        max: sorted[sorted.length - 1],
        count: sorted.length,
      };
    }

    return { metrics: this.metrics, summary };
  }

  clear(): void {
    this.metrics = [];
    this.renderCounts.clear();
  }
}

export const perfDiagnostics = new PerformanceDiagnostics();
export { PerformanceDiagnostics };
