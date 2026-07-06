import type { SnapshotTelemetry, TelemetryAlert } from './SnapshotTelemetryTypes';

export interface SnapshotTelemetryCollector {
  onTelemetry(telemetry: SnapshotTelemetry, alerts: TelemetryAlert[]): void;
}

function formatDuration(ms: number): string {
  return ms < 1 ? '<1ms' : `${Math.round(ms)}ms`;
}

function formatPhaseLine(label: string, ms: number): string {
  const bar = ms > 0 ? '█'.repeat(Math.min(Math.round(ms / 2), 20)) : '·';
  return `  ${label.padEnd(20)} ${formatDuration(ms).padStart(7)}  ${bar}`;
}

export class ConsoleTelemetryCollector implements SnapshotTelemetryCollector {
  onTelemetry(telemetry: SnapshotTelemetry, alerts: TelemetryAlert[]): void {
    const { reason, snapshotId, cacheHit, durationMs, phaseTiming, subjects, flashcards, hash } = telemetry;

    console.log(`[SnapshotTelemetry] #${snapshotId} ${reason} | ${cacheHit ? 'CACHE HIT' : 'CACHE MISS'} | ${formatDuration(durationMs)} | hash=${hash}`);

    console.log(`  ${'Phase'.padEnd(20)} ${'Duration'.padStart(7)}  Timeline`);
    console.log(formatPhaseLine('Repository read', phaseTiming.repositoryReadMs));
    console.log(formatPhaseLine('Aggregation', phaseTiming.aggregationMs));
    console.log(formatPhaseLine('Snapshot create', phaseTiming.snapshotCreateMs));
    console.log(formatPhaseLine('Freeze', phaseTiming.freezeMs));
    console.log(formatPhaseLine('Cache write', phaseTiming.cacheWriteMs));
    console.log(`  ${'─'.repeat(33)}`);
    console.log(`  ${'TOTAL'.padEnd(20)} ${formatDuration(durationMs).padStart(7)}`);
    console.log(`  Subjects: ${subjects} | Flashcards: ${flashcards}`);

    if (alerts.length > 0) {
      for (const alert of alerts) {
        console.warn(`[SnapshotTelemetry] ⚠ ${alert.severity}: ${alert.message} (${alert.value} vs ${alert.threshold})`);
      }
    }
  }
}

export class MmkvTelemetryCollector implements SnapshotTelemetryCollector {
  private storageKey = 'snapshot_telemetry_ring';

  private getMMKV(): any {
    try {
      return require('react-native-mmkv').createMMKV();
    } catch {
      return null;
    }
  }

  onTelemetry(telemetry: SnapshotTelemetry): void {
    const mmkv = this.getMMKV();
    if (!mmkv) return;

    try {
      const raw = mmkv.getString(this.storageKey);
      const ring: any[] = raw ? JSON.parse(raw) : [];
      ring.push({
        snapshotId: telemetry.snapshotId,
        reason: telemetry.reason,
        cacheHit: telemetry.cacheHit,
        durationMs: telemetry.durationMs,
        subjects: telemetry.subjects,
        flashcards: telemetry.flashcards,
        hash: telemetry.hash,
        timestamp: telemetry.timestamp,
      });

      const MAX = 100;
      if (ring.length > MAX) {
        ring.splice(0, ring.length - MAX);
      }

      mmkv.set(this.storageKey, JSON.stringify(ring));
    } catch { }
  }
}
