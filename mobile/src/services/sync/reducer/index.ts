import type { SyncQueueItem } from '../../database/repositories/SyncQueueRepository';
import { reduceEntity, type ReducedOperation } from './OperationReducer';
import { resolveDependencies } from './DependencyResolver';
import { validateOperations, validateEntityIds, type ValidationError } from './ValidationRules';
import { createReport, type ReductionReport, EMPTY_REPORT } from './ReductionReport';

export interface ReduceResult {
  operations: ReducedOperation[];
  report: ReductionReport;
  errors: ValidationError[];
  droppedIds: number[];
}

export function reduce(
  pending: SyncQueueItem[],
  existingEntityIds?: Set<string>,
): ReduceResult {
  if (pending.length === 0) {
    return { operations: [], report: EMPTY_REPORT, errors: [], droppedIds: [] };
  }

  const startTime = Date.now();
  let merged = 0;
  let removed = 0;
  let noop = 0;

  // 1. Agrupar por (entity_type, entity_id)
  const groups = new Map<string, SyncQueueItem[]>();
  for (const item of pending) {
    const key = `${item.entity_type}:${item.entity_id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  const originalCount = pending.length;

  // 2. Reducir cada grupo
  const reduced: ReducedOperation[] = [];
  const droppedIds: number[] = [];
  
  for (const [_key, items] of groups) {
    if (items.length > 1) {
      merged += items.length - 1;
    }
    const result = reduceEntity(items);
    if (result === null) {
      removed += items.length;
      noop++;
      droppedIds.push(...items.map(i => i.id!));
    } else {
      reduced.push(result);
      // Las operaciones fusionadas se pierden, el resultado solo tiene los originalIds de las que sobrevivieron?
      // Wait, reduceEntity devuelve TODOS los originalIds en `result.originalIds`.
      // Entonces droppedIds solo necesita los ítems que retornaron null.
    }
  }

  // 3. Ordenar topológicamente
  const sorted = resolveDependencies(reduced);

  // 4. Validar
  const errors = validateOperations(sorted);
  if (existingEntityIds && existingEntityIds.size > 0) {
    const idErrors = validateEntityIds(sorted, existingEntityIds);
    errors.push(...idErrors);
  }

  const report = createReport(originalCount, sorted, merged, removed, noop, startTime);

  return { operations: sorted, report, errors, droppedIds };
}
