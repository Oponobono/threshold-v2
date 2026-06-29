import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { reduce } from '../../reducer/index';
import { syncDebugger } from '../../SyncDebugger';
import { databaseService } from '../../../database/DatabaseService';

export class QueueReductionScenario implements SyncScenario {
  id = 'queue-reduction';
  name = 'Cola Reducida: 10 CREATEs + 20 UPDATEs → 10 operaciones';
  description = 'Verifica que múltiples UPDATEs del mismo ID se colapsan a una sola operación';

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(): Promise<string> {
    const traceId = `test_reduce_${Date.now()}`;

    for (let i = 1; i <= 10; i++) {
      const entityId = `reduce-test-${String(i).padStart(3, '0')}`;

      await syncQueueRepository.enqueue({
        entity_type: 'subject',
        entity_id: entityId,
        operation: 'CREATE',
        payload: JSON.stringify({ id: entityId, name: `Subject ${i}`, user_id: 'test-user' }),
        trace_id: traceId,
      });

      await syncQueueRepository.enqueue({
        entity_type: 'subject',
        entity_id: entityId,
        operation: 'UPDATE',
        payload: JSON.stringify({ id: entityId, name: `Subject ${i} v2`, user_id: 'test-user' }),
        trace_id: traceId,
      });

      await syncQueueRepository.enqueue({
        entity_type: 'subject',
        entity_id: entityId,
        operation: 'UPDATE',
        payload: JSON.stringify({ id: entityId, name: `Subject ${i} v3`, user_id: 'test-user' }),
        trace_id: traceId,
      });
    }

    syncDebugger.log(traceId, null, null, 'TEST', `Enqueued 30 operations (10 CREATE + 20 UPDATE)`);
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();
    const { operations, report } = reduce(pending);

    const expectedOps = 10;
    const merged = 20;
    const status = operations.length === expectedOps && report.merged === merged ? 'PASS' : 'FAIL';
    const error = status === 'FAIL'
      ? `Expected ${expectedOps} ops, got ${operations.length} (merged=${report.merged}, expected=${merged})`
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
