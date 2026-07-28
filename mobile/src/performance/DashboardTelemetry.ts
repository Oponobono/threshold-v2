/**
 * DashboardTelemetry
 *
 * Instrumentación ligera del ciclo de vida post-boot del Dashboard.
 * Registra el momento de mount y la duración de cada fase de carga.
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
  }

  startPhase(name: string): () => void {
    const entry: PhaseEntry = { name, startMs: Date.now() };
    this.phases.push(entry);
    return () => {
      entry.durationMs = Date.now() - entry.startMs;
    };
  }

  report(): void {
    if (!__DEV__) return;
    const totalMs = Date.now() - this.mountAt;
    const lines = this.phases.map(p => {
      const offset = (p.startMs - this.mountAt).toFixed(0);
      const dur = p.durationMs !== undefined ? `${p.durationMs}ms` : 'pending';
      return `  ${p.name.padEnd(20)} +${offset}ms offset  ${dur} duration`;
    });
    console.log(
      `[DashboardTelemetry] Post-boot lifecycle (${totalMs}ms total)\n` +
        lines.join('\n')
    );
  }
}

export const dashboardTelemetry = new DashboardTelemetry();
