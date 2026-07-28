export const DashboardPriority = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
} as const;

export type DashboardPriorityValue = (typeof DashboardPriority)[keyof typeof DashboardPriority];
