import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { reduce } from '../../reducer/index';
import { resolveDependencies } from '../../reducer/DependencyResolver';
import { syncDebugger } from '../../SyncDebugger';

export class DependencyScenario implements SyncScenario {
  id = 'dependency-order';
  name = 'Dependencias: Course → Subject → Assessment orden correcto';
  description = 'Verifica que el DependencyResolver ordena Course antes que Subject antes que Assessment';

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(): Promise<string> {
    const traceId = `test_dep_${Date.now()}`;

    // Enqueue in reverse order to test sorting
    await syncQueueRepository.enqueue({
      entity_type: 'assessment',
      entity_id: 'assess-001',
      operation: 'CREATE',
      payload: JSON.stringify({ id: 'assess-001', name: 'Test Assessment', subject_id: 'subj-001', user_id: 'test-user' }),
      trace_id: traceId,
    });

    await syncQueueRepository.enqueue({
      entity_type: 'subject',
      entity_id: 'subj-001',
      operation: 'CREATE',
      payload: JSON.stringify({ id: 'subj-001', name: 'Test Subject', course_id: 'course-001', user_id: 'test-user' }),
      trace_id: traceId,
    });

    await syncQueueRepository.enqueue({
      entity_type: 'course',
      entity_id: 'course-001',
      operation: 'CREATE',
      payload: JSON.stringify({ id: 'course-001', name: 'Test Course', user_id: 'test-user' }),
      trace_id: traceId,
    });

    syncDebugger.log(traceId, null, null, 'TEST', 'Enqueued 3 entities in reverse order');
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();
    const { operations } = reduce(pending);
    const sorted = resolveDependencies(operations);

    const order = sorted.map(o => `${o.entity_type}:${o.entity_id}`);
    const expectedOrder = ['course:course-001', 'subject:subj-001', 'assessment:assess-001'];
    const orderStr = order.join(', ');
    const expectedStr = expectedOrder.join(', ');

    const status = orderStr === expectedStr ? 'PASS' : 'FAIL';
    const error = status === 'FAIL'
      ? `Expected order [${expectedStr}], got [${orderStr}]`
      : undefined;

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error,
      metrics: {
        durationMs: 0,
        queueOriginal: pending.length,
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
