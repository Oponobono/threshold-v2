import type { ReducedOperation } from './OperationReducer';

export type ReductionReport = {
  originalOperations: number;
  reducedOperations: number;
  merged: number;
  removed: number;
  noop: number;
  restored: number;
  durationMs: number;
};

export function createReport(
  originalCount: number,
  reduced: ReducedOperation[],
  merged: number,
  removed: number,
  noop: number,
  startTime: number,
): ReductionReport {
  const restored = reduced.filter(o => o.operation === 'RESTORE').length;
  return {
    originalOperations: originalCount,
    reducedOperations: reduced.length,
    merged,
    removed,
    noop,
    restored,
    durationMs: Date.now() - startTime,
  };
}

export const EMPTY_REPORT: ReductionReport = {
  originalOperations: 0,
  reducedOperations: 0,
  merged: 0,
  removed: 0,
  noop: 0,
  restored: 0,
  durationMs: 0,
};
