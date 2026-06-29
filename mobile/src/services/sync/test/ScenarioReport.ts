import type { ScenarioReport, ScenarioResult } from './types';

export function formatScenarioReport(report: ScenarioReport): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════');
  lines.push('  TEST HARNESS — SCENARIO REPORT');
  lines.push(`  ${report.timestamp}`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`  Total: ${report.totalScenarios}  |  ✅ PASS: ${report.passed}  |  ❌ FAIL: ${report.failed}  |  ⏭️  SKIP: ${report.skipped}`);
  lines.push(`  Duration: ${report.totalDurationMs}ms`);
  if (report.faultsUsed.length > 0) {
    lines.push(`  Faults injected: ${report.faultsUsed.map(f => f.faultType).join(', ')}`);
  }
  lines.push('');

  for (const result of report.results) {
    lines.push(formatScenarioResult(result));
    lines.push('');
  }

  lines.push('═══════════════════════════════════════');
  lines.push(report.failed === 0 ? '  ✅ ALL SCENARIOS PASSED' : `  ❌ ${report.failed} SCENARIO(S) FAILED`);
  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}

function formatScenarioResult(result: ScenarioResult): string {
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'ERROR' ? '⚠️' : '⏭️';
  const lines: string[] = [];

  lines.push(`${icon} [${result.scenarioId}] ${result.scenarioName}`);
  lines.push(`   Status: ${result.status}`);
  lines.push(`   Duration: ${result.metrics.durationMs}ms`);

  if (result.traceId) {
    lines.push(`   TraceId: ${result.traceId}`);
  }

  if (result.metrics.queueOriginal > 0 || result.metrics.queueReduced > 0) {
    lines.push(`   Queue: ${result.metrics.queueOriginal} → ${result.metrics.queueReduced}`);
  }
  if (result.metrics.uploaded > 0) lines.push(`   Uploaded: ${result.metrics.uploaded}`);
  if (result.metrics.downloaded > 0) lines.push(`   Downloaded: ${result.metrics.downloaded}`);
  if (result.metrics.validatorErrors > 0) lines.push(`   Validator Errors: ${result.metrics.validatorErrors}`);
  if (result.metrics.conflicts > 0) lines.push(`   Conflicts: ${result.metrics.conflicts}`);
  if (result.metrics.retries > 0) lines.push(`   Retries: ${result.metrics.retries}`);

  if (result.error) {
    lines.push(`   Error: ${result.error}`);
  }

  return lines.join('\n');
}
