import type { SyncScenario, ScenarioResult, ScenarioMetrics, FaultRule, ScenarioReport } from './types';
import { faultInjector } from './FaultInjector';

const SCENARIO_TIMEOUT_MS = 30000;

export class ScenarioRunner {
  private scenarios: SyncScenario[] = [];

  register(scenario: SyncScenario): void {
    this.scenarios.push(scenario);
  }

  registerAll(scenarios: SyncScenario[]): void {
    this.scenarios.push(...scenarios);
  }

  async runAll(faults?: FaultRule[]): Promise<ScenarioReport> {
    const startTime = Date.now();
    const results: ScenarioResult[] = [];
    const faultsUsed = faults ?? [];

    for (const scenario of this.scenarios) {
      let result: ScenarioResult;
      const scenarioStartTime = Date.now();

      try {
        await scenario.setup();

        if (faults && faults.length > 0) {
          faultInjector.enable(faults);
        }

        const traceId = await Promise.race([
          scenario.execute(faults),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error(`Scenario "${scenario.name}" timed out after ${SCENARIO_TIMEOUT_MS}ms`)), SCENARIO_TIMEOUT_MS)
          ),
        ]);

        if (faultInjector.enabled) {
          faultInjector.disable();
        }

        result = await scenario.validate();
        result.traceId = traceId;

        await scenario.cleanup();
      } catch (error: any) {
        result = {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          status: 'ERROR',
          error: error.message,
          metrics: {
            durationMs: Date.now() - scenarioStartTime,
            queueOriginal: 0,
            queueReduced: 0,
            uploaded: 0,
            downloaded: 0,
            validatorErrors: 0,
            conflicts: 0,
            retries: 0,
            memoryMB: 0,
          },
        };

        try { await scenario.cleanup(); } catch { /* ignore cleanup errors */ }
      } finally {
        faultInjector.disable();
      }

      results.push(result);
    }

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR').length;
    const skipped = results.filter(r => r.status === 'SKIPPED').length;

    return {
      timestamp: new Date().toISOString(),
      totalScenarios: results.length,
      passed,
      failed,
      skipped,
      totalDurationMs: Date.now() - startTime,
      results,
      faultsUsed,
    };
  }

  async runSingle(scenarioId: string, faults?: FaultRule[]): Promise<ScenarioResult | null> {
    const scenario = this.scenarios.find(s => s.id === scenarioId);
    if (!scenario) return null;

    const results = await this.runAll(faults);
    return results.results.find(r => r.scenarioId === scenarioId) ?? null;
  }

  clear(): void {
    this.scenarios = [];
  }
}

export const scenarioRunner = new ScenarioRunner();
