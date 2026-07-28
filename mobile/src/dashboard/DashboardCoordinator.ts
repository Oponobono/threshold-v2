import type { DashboardTask } from './DashboardTask';

/**
 * DashboardCoordinator
 *
 * Orquesta las cargas post-boot del Dashboard de forma SECUENCIAL y en orden
 * de prioridad, garantizando cero solapamiento entre queries SQLite pesadas.
 *
 * Modelo de ejecución:
 *   setTimeout(150ms)             ← protege el primer frame del Dashboard
 *     └── await Task P1.execute() ← red + SQLite, bridge se calienta
 *           └── await Task P2.execute() ← SQLite, bridge ya warm
 *
 * start() retorna Promise<void> que se resuelve cuando TODAS las tareas
 * completaron. Los consumidores externos (ej. Knowledge snapshot) esperan
 * esta promesa antes de emitir sus propias queries al bridge.
 *
 * No responsabilidades:
 *   - No conoce repositorios ni stores
 *   - No gestiona ciclo de vida de hooks React
 *   - No controla Knowledge snapshot (eso vive en useKnowledgeInsights)
 */
export class DashboardCoordinator {
  private cancelled = false;
  private controllers = new Map<string, AbortController>();
  private baseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly tasks: DashboardTask[]) {}

  start(): Promise<void> {
    const sorted = [...this.tasks].sort((a, b) => a.priority - b.priority);

    return new Promise<void>((resolve) => {
      // setTimeout base: cede el primer frame antes de empezar las cargas.
      this.baseTimer = setTimeout(async () => {
        for (const task of sorted) {
          if (this.cancelled) break;

          const ctrl = new AbortController();
          this.controllers.set(task.id, ctrl);

          try {
            // await secuencial: la siguiente tarea no empieza hasta que
            // la actual complete (red + SQLite). Bridge exclusivo por tarea.
            await task.execute(ctrl.signal);
          } catch {
            // El fallo de una tarea no bloquea las siguientes.
          } finally {
            this.controllers.delete(task.id);
          }
        }

        // Resolver cuando TODAS las tareas completaron (o fueron canceladas).
        resolve();
      }, 150);
    });
  }

  cancel(): void {
    this.cancelled = true;
    if (this.baseTimer !== null) {
      clearTimeout(this.baseTimer);
      this.baseTimer = null;
    }
    this.controllers.forEach(c => c.abort());
    this.controllers.clear();
  }
}
