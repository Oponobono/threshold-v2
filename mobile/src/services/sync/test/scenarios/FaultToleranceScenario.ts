import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { syncService } from '../../../database/SyncService';
import { reduce } from '../../reducer/index';
import { faultInjector } from '../FaultInjector';
import { syncDebugger } from '../../SyncDebugger';

export class FaultToleranceScenario implements SyncScenario {
  id = 'fault-tolerance';
  name = 'Tolerancia a Fallos: HTTP 500 + 429 + Timeout + Token Expired';
  description = 'Verifica que el sistema maneja fallos HTTP sin corrupción de datos';

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(faults?: FaultRule[]): Promise<string> {
    const traceId = `test_fault_${Date.now()}`;

    // Enqueue some operations that will trigger HTTP calls
    for (let i = 1; i <= 5; i++) {
      await syncQueueRepository.enqueue({
        entity_type: 'subject',
        entity_id: `fault-test-${i}`,
        operation: 'CREATE',
        payload: JSON.stringify({ id: `fault-test-${i}`, name: `Fault Test ${i}`, user_id: 'test-user' }),
        trace_id: traceId,
      });
    }

    // Attempt sync with faults enabled
    if (faults && faults.length > 0) {
      faultInjector.enable(faults);
    }

    try {
      await syncService.sync(traceId, { force: true });
    } catch {
      // Expected to fail — the test validates queue state, not HTTP success
    }

    if (faultInjector.enabled) {
      faultInjector.disable();
    }

    syncDebugger.log(traceId, null, null, 'TEST', `Fault tolerance test executed with ${faults?.length ?? 0} fault rules`);
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();

    // With faults injected, items should remain in queue as 'pending' (not lost)
    const status = pending.length >= 5 ? 'PASS' : 'FAIL';

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error: status === 'FAIL' ? `Expected >=5 pending items, got ${pending.length} (data may have been lost)` : undefined,
      metrics: {
        durationMs: 0,
        queueOriginal: pending.length,
        queueReduced: 0,
        uploaded: 0,
        downloaded: 0,
        validatorErrors: 0,
        conflicts: 0,
        retries: faultInjector.injected,
        memoryMB: 0,
      },
    };
  }

  async cleanup(): Promise<void> {
    if (faultInjector.enabled) faultInjector.disable();
    await syncQueueRepository.clearAll();
  }
}
