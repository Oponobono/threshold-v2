import { reduce } from '../reducer/index';
import { reduceEntity } from '../reducer/OperationReducer';
import { resolveDependencies, getEntityRank } from '../reducer/DependencyResolver';
import type { SyncQueueItem } from '../../database/repositories/SyncQueueRepository';

function makeOp(overrides: Partial<SyncQueueItem> & { entity_type: string; entity_id: string; operation: 'CREATE' | 'UPDATE' | 'DELETE' }): SyncQueueItem {
  return {
    id: Math.floor(Math.random() * 100000),
    payload: undefined,
    status: 'pending',
    retries: 0,
    ...overrides,
  };
}

function payload(obj: any): string {
  return JSON.stringify(obj);
}

describe('OperationReducer (pure function)', () => {
  test('CREATE+UPDATE+DELETE → no-op (null)', () => {
    const items = [
      makeOp({ id: 1, entity_type: 'subject', entity_id: 'e1', operation: 'CREATE', payload: payload({ id: 'e1', name: 'Test', user_id: 'u1' }) }),
      makeOp({ id: 2, entity_type: 'subject', entity_id: 'e1', operation: 'UPDATE', payload: payload({ id: 'e1', name: 'Updated', user_id: 'u1' }) }),
      makeOp({ id: 3, entity_type: 'subject', entity_id: 'e1', operation: 'DELETE' }),
    ];
    const result = reduceEntity(items);
    expect(result).toBeNull();
  });

  test('CREATE+CREATE → CREATE (latest payload)', () => {
    const items = [
      makeOp({ id: 1, entity_type: 'subject', entity_id: 'e2', operation: 'CREATE', payload: payload({ id: 'e2', name: 'V1', user_id: 'u1' }) }),
      makeOp({ id: 2, entity_type: 'subject', entity_id: 'e2', operation: 'CREATE', payload: payload({ id: 'e2', name: 'V2', user_id: 'u1' }) }),
    ];
    const result = reduceEntity(items);
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('CREATE');
    expect(result!.payload.name).toBe('V2');
    expect(result!.originalIds).toEqual([1, 2]);
  });

  test('UPDATE+UPDATE+UPDATE → UPDATE (latest payload)', () => {
    const items = [
      makeOp({ id: 1, entity_type: 'subject', entity_id: 'e3', operation: 'UPDATE', payload: payload({ id: 'e3', name: 'V1', user_id: 'u1' }) }),
      makeOp({ id: 2, entity_type: 'subject', entity_id: 'e3', operation: 'UPDATE', payload: payload({ id: 'e3', name: 'V2', user_id: 'u1' }) }),
      makeOp({ id: 3, entity_type: 'subject', entity_id: 'e3', operation: 'UPDATE', payload: payload({ id: 'e3', name: 'V3', user_id: 'u1' }) }),
    ];
    const result = reduceEntity(items);
    expect(result!.operation).toBe('UPDATE');
    expect(result!.payload.name).toBe('V3');
  });

  test('DELETE → DELETE', () => {
    const items = [
      makeOp({ id: 1, entity_type: 'subject', entity_id: 'e4', operation: 'DELETE' }),
    ];
    const result = reduceEntity(items);
    expect(result!.operation).toBe('DELETE');
    expect(result!.payload).toBeUndefined();
  });

  test('DELETE+CREATE → RESTORE', () => {
    const items = [
      makeOp({ id: 1, entity_type: 'subject', entity_id: 'e5', operation: 'DELETE' }),
      makeOp({ id: 2, entity_type: 'subject', entity_id: 'e5', operation: 'CREATE', payload: payload({ id: 'e5', name: 'Restored', user_id: 'u1' }) }),
    ];
    const result = reduceEntity(items);
    expect(result).not.toBeNull();
    expect(result!.operation).toBe('RESTORE');
    expect(result!.payload.name).toBe('Restored');
  });

  test('Empty array → null', () => {
    const result = reduceEntity([]);
    expect(result).toBeNull();
  });
});

describe('reduce() integration (pure function)', () => {
  test('agrupa múltiples entidades', () => {
    const items = [
      makeOp({ id: 1, entity_type: 'course', entity_id: 'c1', operation: 'CREATE', payload: payload({ id: 'c1', name: 'Course', user_id: 'u1' }) }),
      makeOp({ id: 2, entity_type: 'subject', entity_id: 's1', operation: 'CREATE', payload: payload({ id: 's1', name: 'Subject', user_id: 'u1' }) }),
      makeOp({ id: 3, entity_type: 'subject', entity_id: 's1', operation: 'DELETE' }),
      makeOp({ id: 4, entity_type: 'course', entity_id: 'c1', operation: 'DELETE' }),
    ];
    const { operations, report, errors } = reduce(items);
    expect(operations.length).toBe(0);
    expect(report.originalOperations).toBe(4);
    expect(report.removed).toBe(4);
    expect(errors.length).toBe(0);
  });

  test('reduce(reduce(q)) === reduce(q) — idempotence', () => {
    const items = [
      makeOp({ id: 1, entity_type: 'subject', entity_id: 'e1', operation: 'CREATE', payload: payload({ id: 'e1', name: 'T1', user_id: 'u1' }) }),
      makeOp({ id: 2, entity_type: 'subject', entity_id: 'e1', operation: 'UPDATE', payload: payload({ id: 'e1', name: 'T2', user_id: 'u1' }) }),
      makeOp({ id: 3, entity_type: 'course', entity_id: 'c1', operation: 'CREATE', payload: payload({ id: 'c1', name: 'C1', user_id: 'u1' }) }),
    ];
    const first = reduce(items);
    const second = reduce(first.operations.map(o => ({
      id: 0,
      entity_type: o.entity_type,
      entity_id: o.entity_id,
      operation: o.operation === 'RESTORE' ? 'CREATE' as const : o.operation as 'CREATE' | 'UPDATE' | 'DELETE',
      payload: o.payload ? JSON.stringify(o.payload) : undefined,
      status: 'pending' as const,
      retries: 0,
    })));
    expect(second.operations.length).toBe(first.operations.length);
    expect(second.operations.map(o => `${o.operation}:${o.entity_id}`).sort())
      .toEqual(first.operations.map(o => `${o.operation}:${o.entity_id}`).sort());
  });
});

describe('DependencyResolver', () => {
  test('ordena course < subject < assessment', () => {
    const ops = [
      { operation: 'CREATE' as const, entity_type: 'assessment', entity_id: 'a1', payload: { id: 'a1' }, originalIds: [3] },
      { operation: 'CREATE' as const, entity_type: 'course', entity_id: 'c1', payload: { id: 'c1' }, originalIds: [1] },
      { operation: 'CREATE' as const, entity_type: 'subject', entity_id: 's1', payload: { id: 's1' }, originalIds: [2] },
    ];
    const sorted = resolveDependencies(ops);
    expect(sorted[0].entity_type).toBe('course');
    expect(sorted[1].entity_type).toBe('subject');
    expect(sorted[2].entity_type).toBe('assessment');
  });

  test('DELETE antes que CREATE', () => {
    const ops = [
      { operation: 'CREATE' as const, entity_type: 'subject', entity_id: 's1', payload: { id: 's1' }, originalIds: [1] },
      { operation: 'DELETE' as const, entity_type: 'subject', entity_id: 's1', payload: undefined, originalIds: [2] },
    ];
    const sorted = resolveDependencies(ops);
    expect(sorted[0].operation).toBe('DELETE');
    expect(sorted[1].operation).toBe('CREATE');
  });

  test('unknown entity type gets rank 99', () => {
    expect(getEntityRank('nonexistent')).toBe(99);
    expect(getEntityRank('course')).toBe(1);
  });
});

describe('Stress test — large batches', () => {
  test('reduce 1000 operations without error', () => {
    const items: SyncQueueItem[] = [];
    for (let i = 0; i < 1000; i++) {
      const entityId = `stress-${i % 50}`;
      items.push(makeOp({
        id: i + 1,
        entity_type: 'flashcard',
        entity_id: entityId,
        operation: i % 3 === 0 ? 'CREATE' : i % 3 === 1 ? 'UPDATE' : 'DELETE',
        payload: i % 3 !== 2 ? payload({ id: entityId, question: `Q${i}`, deck_id: 'd1' }) : undefined,
      }));
    }
    const start = Date.now();
    const { operations, report, errors } = reduce(items);
    const duration = Date.now() - start;
    expect(errors.length).toBe(0);
    expect(report.originalOperations).toBe(1000);
    expect(operations.length).toBeLessThanOrEqual(50);
    expect(duration).toBeLessThan(5000);
  });
});
