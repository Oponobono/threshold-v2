import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { reduce } from '../../reducer/index';
import { syncDebugger } from '../../SyncDebugger';

export class DeterminismScenario implements SyncScenario {
  id = 'determinism';
  name = 'Determinismo e Idempotencia: reduce(reduce(queue)) === reduce(queue)';
  description = 'Verifica que el reducer es determinista (misma entrada → misma salida) e idempotente (aplicar dos veces no cambia el resultado)';

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(): Promise<string> {
    const traceId = `test_det_${Date.now()}`;

    const patterns = [
      ['CREATE', 'UPDATE', 'UPDATE', 'DELETE'],
      ['CREATE', 'DELETE', 'CREATE'],
      ['UPDATE', 'UPDATE', 'UPDATE'],
      ['CREATE', 'CREATE', 'UPDATE'],
      ['DELETE', 'CREATE', 'UPDATE'],
    ];

    for (let p = 0; p < patterns.length; p++) {
      const entityId = `det-entity-${p}`;
      for (const op of patterns[p]) {
        await syncQueueRepository.enqueue({
          entity_type: 'subject',
          entity_id: entityId,
          operation: op as 'CREATE' | 'UPDATE' | 'DELETE',
          payload: op !== 'DELETE' ? JSON.stringify({ id: entityId, name: `Det ${p}`, user_id: 'test-user' }) : undefined,
          trace_id: traceId,
        });
      }
    }

    syncDebugger.log(traceId, null, null, 'TEST', `Enqueued ${patterns.length} complex patterns for determinism test`);
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();

    // First reduction
    const firstPass = reduce(pending);
    const firstOps = firstPass.operations;

    // Second reduction (reduce the reduced)
    const reducedItems = firstOps.map(o => ({
      id: 0,
      entity_type: o.entity_type,
      entity_id: o.entity_id,
      operation: o.operation as 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE',
      payload: o.payload ? JSON.stringify(o.payload) : undefined,
      status: 'pending' as const,
      retries: 0,
    }));
    // Map RESTORE back for re-reduce
    const secondPass = reduce(reducedItems.map(i => ({
      ...i,
      operation: i.operation === 'RESTORE' ? 'CREATE' as const : i.operation,
    })));
    const secondOps = secondPass.operations;

    // Determinism check: running reduce twice on same input
    const thirdPass = reduce(pending);
    const firstStr = JSON.stringify(firstPass.operations);
    const thirdStr = JSON.stringify(thirdPass.operations);
    const isDeterministic = firstStr === thirdStr;

    // Idempotence check: reducing already-reduced doesn't change
    const secondStr = JSON.stringify(secondOps.map(o => `${o.operation}:${o.entity_type}:${o.entity_id}`));
    const firstSimple = firstOps.map(o => `${o.operation}:${o.entity_type}:${o.entity_id}`);
    const firstSimpleStr = JSON.stringify(firstSimple);
    const isIdempotent = secondStr === firstSimpleStr;

    const status = isDeterministic && isIdempotent ? 'PASS' : 'FAIL';
    const errors: string[] = [];
    if (!isDeterministic) errors.push('Reducer is NOT deterministic');
    if (!isIdempotent) errors.push('Reducer is NOT idempotent');

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      metrics: {
        durationMs: firstPass.report.durationMs + secondPass.report.durationMs,
        queueOriginal: pending.length,
        queueReduced: firstOps.length,
        uploaded: 0,
        downloaded: 0,
        validatorErrors: 0,
        conflicts: 0,
        retries: 0,
        memoryMB: 0,
      },
    };
  }

  async cleanup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }
}
