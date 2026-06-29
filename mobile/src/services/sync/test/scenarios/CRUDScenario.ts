import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { reduce } from '../../reducer/index';
import { syncDebugger } from '../../SyncDebugger';

export class CRUDScenario implements SyncScenario {
  id = 'crud-offline';
  name = 'CRUD Offline: CREATE → UPDATE → DELETE → Reducer → No-op';
  description = 'Verifica que la secuencia CREATE+UPDATE+DELETE del mismo ID resulta en no-op tras reducir';

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(): Promise<string> {
    const traceId = `test_crud_${Date.now()}`;
    const entityId = 'test-entity-001';

    await syncQueueRepository.enqueue({
      entity_type: 'subject',
      entity_id: entityId,
      operation: 'CREATE',
      payload: JSON.stringify({ id: entityId, name: 'Test Subject', user_id: 'test-user' }),
      trace_id: traceId,
    });
    syncDebugger.log(traceId, null, null, 'TEST', 'CREATE enqueued', undefined, 'subject', entityId);

    await syncQueueRepository.enqueue({
      entity_type: 'subject',
      entity_id: entityId,
      operation: 'UPDATE',
      payload: JSON.stringify({ id: entityId, name: 'Updated Subject', user_id: 'test-user' }),
      trace_id: traceId,
    });
    syncDebugger.log(traceId, null, null, 'TEST', 'UPDATE enqueued', undefined, 'subject', entityId);

    await syncQueueRepository.enqueue({
      entity_type: 'subject',
      entity_id: entityId,
      operation: 'DELETE',
      trace_id: traceId,
    });
    syncDebugger.log(traceId, null, null, 'TEST', 'DELETE enqueued', undefined, 'subject', entityId);

    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();
    const { operations, report } = reduce(pending);

    const status = operations.length === 0 && report.removed === 3 && report.noop === 1 ? 'PASS' : 'FAIL';
    const error = status === 'FAIL'
      ? `Expected no-op, got ${operations.length} operations (removed=${report.removed}, noop=${report.noop})`
      : undefined;

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error,
      metrics: {
        durationMs: report.durationMs,
        queueOriginal: report.originalOperations,
        queueReduced: 0,
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
