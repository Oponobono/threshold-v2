import { DashboardPriority } from './DashboardPriority';
import type { DashboardTask } from './DashboardTask';
import { dashboardTelemetry } from '../performance/DashboardTelemetry';

type StoreActions = {
  syncTodaySchedules: () => Promise<void>;
  refreshOverallGpa: () => Promise<void>;
};

/**
 * buildDashboardTasks
 *
 * Construye la lista de tareas del DashboardCoordinator.
 * No incluye Knowledge (controlado por useKnowledgeInsights internamente)
 * ni Predictions (controlado por usePredictionPolling con su timer de 2s).
 *
 * Prioridades (ejecución SECUENCIAL, no paralela):
 *   P1 — Schedule: corre primero, calienta el bridge (red + SQLite)
 *   P2 — GPA:      corre después de Schedule, bridge ya warm → latencia mínima
 */
export function buildDashboardTasks(store: StoreActions): DashboardTask[] {
  return [
    {
      id: 'gpa',
      priority: DashboardPriority.P2,
      execute: async (signal) => {
        if (signal.aborted) return;
        const end = dashboardTelemetry.startPhase('gpa');
        try {
          await store.refreshOverallGpa();
        } finally {
          end();
        }
      },
    },
  ];
}
