import type { DashboardPriorityValue } from './DashboardPriority';

export interface DashboardTask {
  id: string;
  priority: DashboardPriorityValue;
  execute(signal: AbortSignal): Promise<void>;
}
