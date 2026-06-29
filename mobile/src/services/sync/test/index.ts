import { scenarioRunner, ScenarioRunner } from './ScenarioRunner';
import { formatScenarioReport } from './ScenarioReport';
import { faultInjector } from './FaultInjector';

import { CRUDScenario } from './scenarios/CRUDScenario';
import { QueueReductionScenario } from './scenarios/QueueReductionScenario';
import { DependencyScenario } from './scenarios/DependencyScenario';
import { StressScenario } from './scenarios/StressScenario';
import { FaultToleranceScenario } from './scenarios/FaultToleranceScenario';
import { RestoreScenario } from './scenarios/RestoreScenario';
import { DeterminismScenario } from './scenarios/DeterminismScenario';
import type { ScenarioReport as ScenarioReportType, FaultRule } from './types';

export type { ScenarioReportType, FaultRule };

export { ScenarioRunner, faultInjector, formatScenarioReport };

export function registerDefaultScenarios(runner?: ScenarioRunner): ScenarioRunner {
  const r = runner || scenarioRunner;
  r.registerAll([
    new CRUDScenario(),
    new QueueReductionScenario(),
    new DependencyScenario(),
    new RestoreScenario(),
    new DeterminismScenario(),
    new StressScenario(),
    new FaultToleranceScenario(),
  ]);
  return r;
}

export async function runAllTests(faults?: FaultRule[]): Promise<ScenarioReportType> {
  const runner = registerDefaultScenarios();
  const report = await runner.runAll(faults);
  runner.clear();
  return report;
}

export { scenarioRunner };
