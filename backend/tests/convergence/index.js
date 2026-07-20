const TestEnvironment = require('./TestEnvironment');
const ConsistencyReport = require('./ConsistencyReport');
const DeviceSimulator = require('./DeviceSimulator');

const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

async function main() {
  console.log(`${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
  console.log(`${COLOR.bold}║        Convergence Test Suite (Sync Engine v1)          ║${COLOR.reset}`);
  console.log(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}\n`);

  const env = new TestEnvironment();
  try {
    console.log(`${COLOR.dim}Starting test environment...${COLOR.reset}`);
    await env.start();
    console.log(`${COLOR.green}✓${COLOR.reset} Backend running at ${env.backendUrl}`);
    console.log(`${COLOR.green}✓${COLOR.reset} Test user: ${env.userId}\n`);

    const scenarios = [
      require('./scenarios/basic'),
      require('./scenarios/verification'),
      require('./scenarios/backup'),
      require('./scenarios/restoreValidation'),
    ];

    let totalPassed = 0;
    let totalFailed = 0;
    let totalScenarios = 0;
    let failedScenarios = 0;

    for (const mod of scenarios) {
      const names = Object.keys(mod).filter(k => k.startsWith('scenario'));
      for (const name of names) {
        totalScenarios++;
        const result = await mod[name](env);
        if (result.failed > 0) failedScenarios++;
        totalPassed += result.passed;
        totalFailed += result.failed;
      }
    }

    // Consistency Report at the end — collect devices that are still alive
    console.log(`${COLOR.dim}\nPost-suite consistency check...${COLOR.reset}`);
    const report = new ConsistencyReport('Post-Suite');
    const devices = [];
    // Simulate a fresh device that does a full initial sync to get all data
    const auditor = await env.createDevice('Auditor');
    await auditor._pull(); // initial sync pulls everything
    devices.push(auditor);

    // The backend DB is env.backendDb
    await report.run({ backendDb: env.backendDb, devices: [auditor] });
    console.log(report.format());

    const consistencyPass = report.pass();
    if (!consistencyPass) {
      totalFailed += report._errors.length;
      failedScenarios++;
    }

    console.log(`\n${COLOR.bold}═══════════════════════════════════════════════════════════${COLOR.reset}`);
    const status = totalFailed === 0 ? `${COLOR.green}ALL PASSED${COLOR.reset}` : `${COLOR.red}${failedScenarios} FAILED${COLOR.reset}`;
    console.log(`${COLOR.bold}  Result: ${status}${COLOR.reset}`);
    console.log(`  Scenarios: ${totalScenarios + 1} total, ${totalScenarios + (consistencyPass ? 1 : 0) - failedScenarios} passed, ${failedScenarios} failed`);
    console.log(`  Assertions: ${totalPassed + totalFailed} total, ${totalPassed} passed, ${totalFailed} failed`);
    console.log(`${COLOR.bold}═══════════════════════════════════════════════════════════${COLOR.reset}\n`);

    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (err) {
    console.error(`${COLOR.red}Test environment error:${COLOR.reset}`, err);
    process.exit(1);
  } finally {
    await env.stop();
  }
}

main();
