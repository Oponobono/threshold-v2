import type { SyncScenario, ScenarioResult, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { reduce } from '../../reducer/index';
import { syncDebugger } from '../../SyncDebugger';

const TOTAL_OPS = 10000;
const ENTITY_COUNT = 100;

export class StressScenario implements SyncScenario {
  id = 'stress-10000';
  name = `Estrés: ${TOTAL_OPS} operaciones → Reducer → Validator`;
  description = `Inserta ${TOTAL_OPS} operaciones de ${ENTITY_COUNT} entidades y verifica que el reducer las procesa sin errores`;

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
  }

  async execute(): Promise<string> {
    const traceId = `test_stress_${Date.now()}`;
    const batchSize = 500;

    for (let batch = 0; batch < TOTAL_OPS / batchSize; batch++) {
      const ops: { entity_type: string; entity_id: string; operation: 'CREATE' | 'UPDATE' | 'DELETE'; payload?: string; trace_id?: string }[] = [];

      for (let i = 0; i < batchSize; i++) {
        const idx = batch * batchSize + i;
        const entityId = `stress-${idx % ENTITY_COUNT}`;
        const opType = idx % 3 === 0 ? 'CREATE' : idx % 3 === 1 ? 'UPDATE' : 'DELETE';

        ops.push({
          entity_type: 'flashcard',
          entity_id: entityId,
          operation: opType,
          payload: opType !== 'DELETE' ? JSON.stringify({ id: entityId, question: `Q${idx}`, answer: `A${idx}`, deck_id: 'stress-deck' }) : undefined,
          trace_id: traceId,
        });
      }

      for (const op of ops) {
        await syncQueueRepository.enqueue(op);
      }
    }

    syncDebugger.log(traceId, null, null, 'TEST', `Enqueued ${TOTAL_OPS} operations across ${ENTITY_COUNT} entities`);
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const pending = await syncQueueRepository.getPending();

    let durationMs = 0;
    let reducedCount = 0;
    let mergeErrors = 0;

    try {
      const start = Date.now();
      const { operations, report, errors } = reduce(pending);
      durationMs = Date.now() - start;
      reducedCount = operations.length;
      mergeErrors = errors.length;
    } catch (error: any) {
      return {
        scenarioId: this.id,
        scenarioName: this.name,
        status: 'ERROR',
        error: `Reducer crashed: ${error.message}`,
        metrics: {
          durationMs: 0,
          queueOriginal: pending.length,
          queueReduced: 0,
          uploaded: 0,
          downloaded: 0,
          validatorErrors: 1,
          conflicts: 0,
          retries: 0,
          memoryMB: 0,
        },
      };
    }

    const status = mergeErrors === 0 ? 'PASS' : 'FAIL';

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error: mergeErrors > 0 ? `${mergeErrors} validation errors` : undefined,
      metrics: {
        durationMs,
        queueOriginal: pending.length,
        queueReduced: reducedCount,
        uploaded: 0,
        downloaded: 0,
        validatorErrors: mergeErrors,
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
