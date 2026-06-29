import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { reduce } from '../../reducer/index';
import { syncDebugger } from '../../SyncDebugger';

export class RestoreScenario implements SyncScenario {
  id = 'restore-operation';
  name = 'RESTORE: DELETE → CREATE (mismo ID) → RESTORE operation';
  description = 'Verifica que la secuencia DELETE+CREATE del mismo ID produce RESTORE en lugar de CREATE';

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(): Promise<string> {
    const traceId = `test_restore_${Date.now()}`;
    const entityId = 'restore-entity-001';

    // DELETE seguido de CREATE = restauración
    await syncQueueRepository.enqueue({
      entity_type: 'subject',
      entity_id: entityId,
      operation: 'DELETE',
      trace_id: traceId,
    });

    await syncQueueRepository.enqueue({
      entity_type: 'subject',
      entity_id: entityId,
      operation: 'CREATE',
      payload: JSON.stringify({ id: entityId, name: 'Restored Subject', user_id: 'test-user' }),
      trace_id: traceId,
    });

    syncDebugger.log(traceId, null, null, 'TEST', `DELETE+CREATE enqueued for ${entityId}`);
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();
    const { operations, report } = reduce(pending);

    const hasRestore = operations.some(o => o.operation === 'RESTORE');
    const status = hasRestore && operations.length === 1 ? 'PASS' : 'FAIL';
    const error = status === 'FAIL'
      ? `Expected 1 RESTORE operation, got ${operations.length} (${operations.map(o => o.operation).join(', ')})`
      : undefined;

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error,
      metrics: {
        durationMs: report.durationMs,
        queueOriginal: report.originalOperations,
        queueReduced: operations.length,
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
