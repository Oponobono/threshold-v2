import type {
  SnapshotTelemetry,
  SnapshotTelemetryEntry,
  SnapshotBuildReason,
  SnapshotPhaseTiming,
  TelemetryAlert,
} from './SnapshotTelemetryTypes';
import type { SnapshotTelemetryCollector } from './SnapshotTelemetryCollector';
import type { KnowledgeAggregation } from './query';

export const RING_BUFFER_SIZE = 100;
const DURATION_SAMPLES_MAX = 5000;

const ALERT_THRESHOLDS = {
  buildSlowWarningMs: 200,
  buildSlowErrorMs: 500,
  minCacheHitRatio: 0.8,
  sizeGrowthPercent: 40,
} as const;

let nextSnapshotId = 1;

function computeHash(aggregation: KnowledgeAggregation): string {
  let acc = 0;
  const seed = 'v1';
  const data = seed + aggregation.totalCards + '|' + aggregation.totalSubjects + '|' +
    aggregation.subjects.map(s => Math.round(s.avgRetrievability)).join(',');
  for (let i = 0; i < data.length; i++) {
    const chr = data.charCodeAt(i);
    acc = ((acc << 5) - acc) + chr;
    acc |= 0;
  }
  return Math.abs(acc).toString(16).slice(0, 6);
}

function estimateMemoryKB(aggregation: KnowledgeAggregation): number {
  const perSubject = 256;
  const perFlashcard = 64;
  return Math.round((aggregation.totalSubjects * perSubject + aggregation.totalCards * perFlashcard) / 1024);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export interface ReasonCacheStats {
  reason: SnapshotBuildReason;
  hits: number;
  total: number;
  hitRatio: number;
}

export interface DurationStats {
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  count: number;
}

export class SnapshotTelemetryService {
  private ringBuffer: SnapshotTelemetryEntry[] = [];
  private alerts: TelemetryAlert[] = [];
  private buildCount = 0;
  private cacheHitCount = 0;
  private perReasonStats = new Map<string, { hits: number; total: number }>();
  private allDurations: number[] = [];
  private collectors: SnapshotTelemetryCollector[] = [];

  subscribe(collector: SnapshotTelemetryCollector): () => void {
    this.collectors.push(collector);
    return () => {
      const idx = this.collectors.indexOf(collector);
      if (idx >= 0) this.collectors.splice(idx, 1);
    };
  }

  begin(
    reason: SnapshotBuildReason,
    userId: string,
  ): SnapshotTelemetryContext {
    return new SnapshotTelemetryContext(this, reason, userId, nextSnapshotId++);
  }

  record(context: SnapshotTelemetryContext, aggregation: KnowledgeAggregation): void {
    const telemetry: SnapshotTelemetry = {
      reason: context.reason,
      snapshotId: context.snapshotId,
      cacheHit: context.cacheHit,
      durationMs: context.durationMs,
      phaseTiming: context.phaseTiming,
      subjects: aggregation.totalSubjects,
      participants: 0,
      flashcards: aggregation.totalCards,
      reviews: aggregation.subjects.reduce((s, sub) => s + sub.dueCards, 0),
      memoryEstimateKB: estimateMemoryKB(aggregation),
      hash: computeHash(aggregation),
      timestamp: Date.now(),
    };

    this.buildCount++;
    if (telemetry.cacheHit) this.cacheHitCount++;

    const reasonKey = telemetry.reason as string;
    let reasonStats = this.perReasonStats.get(reasonKey);
    if (!reasonStats) {
      reasonStats = { hits: 0, total: 0 };
      this.perReasonStats.set(reasonKey, reasonStats);
    }
    reasonStats.total++;
    if (telemetry.cacheHit) reasonStats.hits++;

    this.allDurations.push(telemetry.durationMs);
    if (this.allDurations.length > DURATION_SAMPLES_MAX) {
      this.allDurations.splice(0, this.allDurations.length - DURATION_SAMPLES_MAX);
    }

    const entry: SnapshotTelemetryEntry = {
      snapshotId: telemetry.snapshotId,
      reason: telemetry.reason,
      cacheHit: telemetry.cacheHit,
      durationMs: telemetry.durationMs,
      phaseTiming: telemetry.phaseTiming,
      subjects: telemetry.subjects,
      flashcards: telemetry.flashcards,
      hash: telemetry.hash,
      timestamp: telemetry.timestamp,
    };

    this.ringBuffer.push(entry);
    if (this.ringBuffer.length > RING_BUFFER_SIZE) {
      this.ringBuffer.shift();
    }

    const alerts = this.checkAlerts(telemetry);
    this.alerts.push(...alerts);
    if (this.alerts.length > 50) {
      this.alerts.splice(0, this.alerts.length - 50);
    }

    for (const collector of this.collectors) {
      try {
        collector.onTelemetry(telemetry, alerts);
      } catch { }
    }

    if (this.buildCount % 10 === 0) {
      this.logCumulativeStats();
    }
  }

  private logCumulativeStats(): void {
    const durations = this.getDurationStats();
    const reasons = this.getReasonCacheStats();

    console.log(`[SnapshotTelemetry] ── Cumulative Stats (${durations.count} builds) ──`);
    console.log(`  Distribution: avg=${this._fmt(durations.avg)} P50=${this._fmt(durations.p50)} P95=${this._fmt(durations.p95)} P99=${this._fmt(durations.p99)} max=${this._fmt(durations.max)}`);

    for (const r of reasons) {
      const bar = r.total > 0 ? '█'.repeat(Math.min(Math.round(r.hitRatio * 20), 20)) : '·';
      console.log(`    ${r.reason.padEnd(20)} ${r.hits}/${r.total}  ${Math.round(r.hitRatio * 100)}%  ${bar}`);
    }
  }

  private _fmt(ms: number): string {
    return ms < 1 ? '<1ms' : `${Math.round(ms)}ms`;
  }

  getReasonCacheStats(): ReasonCacheStats[] {
    const stats: ReasonCacheStats[] = [];
    for (const [reason, s] of this.perReasonStats) {
      stats.push({
        reason: reason as SnapshotBuildReason,
        hits: s.hits,
        total: s.total,
        hitRatio: s.total > 0 ? s.hits / s.total : 0,
      });
    }
    stats.sort((a, b) => b.total - a.total);
    return stats;
  }

  getDurationStats(): DurationStats {
    const sorted = [...this.allDurations].sort((a, b) => a - b);
    const count = sorted.length;
    if (count === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, max: 0, count: 0 };
    }
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round(sum / count * 10) / 10,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[count - 1],
      count,
    };
  }

  getHistory(): readonly SnapshotTelemetryEntry[] {
    return this.ringBuffer;
  }

  getAlerts(): readonly TelemetryAlert[] {
    return this.alerts;
  }

  cacheHitRatio(): number {
    return this.buildCount > 0 ? this.cacheHitCount / this.buildCount : 0;
  }

  private checkAlerts(t: SnapshotTelemetry): TelemetryAlert[] {
    const alerts: TelemetryAlert[] = [];

    if (t.durationMs > ALERT_THRESHOLDS.buildSlowErrorMs) {
      alerts.push({
        snapshotId: t.snapshotId,
        severity: 'ERROR',
        message: `Snapshot build > ${ALERT_THRESHOLDS.buildSlowErrorMs}ms`,
        value: t.durationMs,
        threshold: ALERT_THRESHOLDS.buildSlowErrorMs,
        timestamp: t.timestamp,
      });
    } else if (t.durationMs > ALERT_THRESHOLDS.buildSlowWarningMs) {
      alerts.push({
        snapshotId: t.snapshotId,
        severity: 'WARNING',
        message: `Snapshot build > ${ALERT_THRESHOLDS.buildSlowWarningMs}ms`,
        value: t.durationMs,
        threshold: ALERT_THRESHOLDS.buildSlowWarningMs,
        timestamp: t.timestamp,
      });
    }

    if (this.buildCount >= 10) {
      const ratio = this.cacheHitRatio();
      if (ratio < ALERT_THRESHOLDS.minCacheHitRatio) {
        alerts.push({
          snapshotId: t.snapshotId,
          severity: 'WARNING',
          message: `Cache hit ratio < ${ALERT_THRESHOLDS.minCacheHitRatio * 100}%`,
          value: Math.round(ratio * 100),
          threshold: ALERT_THRESHOLDS.minCacheHitRatio * 100,
          timestamp: t.timestamp,
        });
      }
    }

    return alerts;
  }
}

export class SnapshotTelemetryContext {
  readonly snapshotId: number;
  readonly reason: SnapshotBuildReason;
  readonly userId: string;
  cacheHit = false;
  durationMs = 0;
  phaseTiming: SnapshotPhaseTiming = {
    repositoryReadMs: 0,
    aggregationMs: 0,
    snapshotCreateMs: 0,
    freezeMs: 0,
    cacheWriteMs: 0,
  };

  private service: SnapshotTelemetryService;
  private startTime: number;

  constructor(
    service: SnapshotTelemetryService,
    reason: SnapshotBuildReason,
    userId: string,
    snapshotId: number,
  ) {
    this.service = service;
    this.reason = reason;
    this.userId = userId;
    this.snapshotId = snapshotId;
    this.startTime = Date.now();
  }

  finish(aggregation: KnowledgeAggregation): void {
    this.durationMs = Date.now() - this.startTime;
    this.service.record(this, aggregation);
  }
}

export const snapshotTelemetry = new SnapshotTelemetryService();
