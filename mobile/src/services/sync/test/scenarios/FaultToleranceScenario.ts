import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { syncService } from '../../../database/SyncService';
import { faultInjector } from '../FaultInjector';
import { syncDebugger } from '../../SyncDebugger';
import { getUserId } from '../../../api/auth/session';

const DEFAULT_FAULTS: FaultRule[] = [{ faultType: 'HTTP_500' }];

export class FaultToleranceScenario implements SyncScenario {
  id = 'fault-tolerance';
  name = 'Tolerancia a Fallos: HTTP 500 + 429 + Timeout + Token Expired';
  description = 'Verifica que el sistema maneja fallos HTTP sin corrupción de datos';

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(faults?: FaultRule[]): Promise<string> {
    const traceId = `test_fault_${Date.now()}`;
    const userId = await getUserId();
    const effectiveUserId = userId || 'test-user';

    // Always enable fault injector — this IS a fault tolerance test
    const effectiveFaults = faults && faults.length > 0 ? faults : DEFAULT_FAULTS;
    faultInjector.enable(effectiveFaults);

    for (let i = 1; i <= 5; i++) {
      await syncQueueRepository.enqueue({
        entity_type: 'subject',
        entity_id: `fault-test-${i}`,
        operation: 'CREATE',
        payload: JSON.stringify({ id: `fault-test-${i}`, name: `Fault Test ${i}`, user_id: effectiveUserId }),
        trace_id: traceId,
      });
    }

    try {
      await syncService.sync(traceId, { force: true });
    } catch {
      // Expected — faults simulate network errors; items stay in queue
    }

    faultInjector.disable();

    syncDebugger.log(traceId, null, null, 'TEST', `Fault tolerance test executed with ${effectiveFaults.length} fault rules`);
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();

    const status = pending.length >= 5 ? 'PASS' : 'FAIL';

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error: status === 'FAIL' ? `Expected >=5 pending items, got ${pending.length} (faults may not have been applied)` : undefined,
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
    faultInjector.disable();
    await syncQueueRepository.clearAll();
  }
}
