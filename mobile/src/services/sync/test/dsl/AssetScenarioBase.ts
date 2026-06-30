import type { SyncScenario, ScenarioResult, ScenarioMetrics, FaultRule } from '../types';
import { syncQueueRepository } from '../../../database/repositories/SyncQueueRepository';
import { syncDebugger } from '../../SyncDebugger';
import { faultInjector } from '../FaultInjector';
import type { AssetTestContext, StepResult, AssetTestStep } from './types';

const EMPTY_METRICS: ScenarioMetrics = {
  durationMs: 0, queueOriginal: 0, queueReduced: 0,
  uploaded: 0, downloaded: 0, validatorErrors: 0,
  conflicts: 0, retries: 0, memoryMB: 0,
};

/**
 * A step that may have an inverted expectation.
 * If expectFail is true, a FAIL result is treated as PASS and vice versa.
 */
export interface AssetTestStepWithExpect extends AssetTestStep {
  expectFail?: boolean;
}

export abstract class AssetScenarioBase implements SyncScenario {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract steps: AssetTestStepWithExpect[];

  async setup(): Promise<void> {
    await syncQueueRepository.clearAll();
    faultInjector.disable();
  }

  async execute(faults?: FaultRule[]): Promise<string> {
    const traceId = `asset-test-${this.id}-${Date.now()}`;
    const ctx: AssetTestContext = {
      state: {},
      metrics: { ...EMPTY_METRICS },
      steps: [],
      traceId,
    };

    if (faults && faults.length > 0) {
      faultInjector.enable(faults);
    }

    syncDebugger.beginSync(traceId, 'test');
    syncDebugger.log(traceId, null, null, 'CONSISTENCY_CHECK', `Starting scenario: ${this.name}`, undefined, 'test', this.id);

    for (const stepDef of this.steps) {
      const result = await stepDef.run(ctx);
      // Invert status if expectFail
      const effectiveStatus = stepDef.expectFail
        ? (result.status === 'FAIL' ? 'PASS' : 'FAIL')
        : result.status;
      const effectiveResult: StepResult = {
        ...result,
        status: effectiveStatus as any,
        error: effectiveStatus === 'FAIL'
          ? (stepDef.expectFail ? `Expected failure but got ${result.status}: ${result.error || 'success'}` : result.error)
          : undefined,
      };
      ctx.steps.push(effectiveResult);
      ctx.metrics.durationMs += result.durationMs;
      if (result.metrics) {
        if (result.metrics.uploaded) ctx.metrics.uploaded += result.metrics.uploaded;
        if (result.metrics.downloaded) ctx.metrics.downloaded += result.metrics.downloaded;
        if (result.metrics.validatorErrors) ctx.metrics.validatorErrors += result.metrics.validatorErrors;
        if (result.metrics.retries) ctx.metrics.retries += result.metrics.retries;
        if (result.metrics.queueOriginal) ctx.metrics.queueOriginal += result.metrics.queueOriginal;
      }
      syncDebugger.log(traceId, null, null, 'CONSISTENCY_CHECK', `[${effectiveResult.status}] ${stepDef.name || effectiveResult.step}: ${result.durationMs}ms${effectiveResult.error ? ' — ' + effectiveResult.error : ''}`, undefined, 'test', this.id);
    }

    this._context = ctx;
    return traceId;
  }

  async validate(): Promise<ScenarioResult> {
    const ctx = this._context;
    if (!ctx) {
      return { scenarioId: this.id, scenarioName: this.name, status: 'ERROR', error: 'No test context', metrics: EMPTY_METRICS };
    }

    const failed = ctx.steps.filter(s => s.status === 'FAIL');
    const status = failed.length === 0 ? 'PASS' : 'FAIL';
    const error = status === 'FAIL'
      ? `Steps failed: ${failed.map(s => `${s.step} (${s.error})`).join('; ')}`
      : undefined;

    return {
      scenarioId: this.id,
      scenarioName: this.name,
      status,
      error,
      metrics: ctx.metrics,
    };
  }

  async cleanup(): Promise<void> {
    await syncQueueRepository.clearAll();
    faultInjector.disable();
    this._context = null;
  }

  private _context: AssetTestContext | null = null;
}
