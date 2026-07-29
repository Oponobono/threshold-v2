/**
 * DashboardTelemetry
 *
 * Instrumentación ligera del ciclo de vida post-boot del Dashboard.
 * Todas las marcas de tiempo son relativas al mount del Dashboard.
 * No tiene dependencias de React ni de SQLite.
 */

interface PhaseEntry {
  name: string;
  startMs: number;
  durationMs?: number;
}

class DashboardTelemetry {
  private mountAt = 0;
  private phases: PhaseEntry[] = [];

  mount(): void {
    this.mountAt = Date.now();
    this.phases = [];
    this.log('MOUNT');
  }

  /** Log inmediato con timestamp relativo. Visible en tiempo real en Logcat. */
  log(event: string, detail?: string): void {
    const t = this.mountAt > 0 ? Date.now() - this.mountAt : 0;
    console.log(`[CoordTrace] +${String(t).padStart(6)}ms  ${event}${detail ? `  ${detail}` : ''}`);
  }

  startPhase(name: string): () => void {
    const now = Date.now();
    const entry: PhaseEntry = { name, startMs: now };
    this.phases.push(entry);
    this.log(`PHASE start: ${name}`);
    return () => {
      entry.durationMs = Date.now() - entry.startMs;
      this.log(`PHASE end:   ${name}`, `${entry.durationMs}ms`);
    };
  }

  report(): void {
    if (!__DEV__) return;
    const totalMs = Date.now() - this.mountAt;
    const lines = this.phases.map(p => {
      const offset = (p.startMs - this.mountAt).toFixed(0);
      const dur = p.durationMs !== undefined ? `${p.durationMs}ms` : 'pending';
      return `  ${p.name.padEnd(20)} +${offset}ms offset  ${dur}`;
    });
    console.log(
      `[DashboardTelemetry] Post-boot lifecycle (${totalMs}ms total)\n` +
        lines.join('\n')
    );
  }
}

export const dashboardTelemetry = new DashboardTelemetry();
