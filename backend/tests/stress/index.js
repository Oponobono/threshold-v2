const SimulationEngine = require('./SimulationEngine');
const RandomScenario = require('./RandomScenario');

const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const TIERS = {
  smoke: {
    label: 'Smoke Test',
    numOps: 100,
    deviceCount: 2,
    verifyInterval: 50,
    weights: SimulationEngine.LIGHT_WEIGHTS,
  },
  regression: {
    label: 'Regression Test',
    numOps: 1000,
    deviceCount: 3,
    verifyInterval: 100,
    weights: SimulationEngine.DEFAULT_WEIGHTS,
  },
  nightly: {
    label: 'Nightly Test',
    numOps: 10000,
    deviceCount: 5,
    verifyInterval: 500,
    weights: SimulationEngine.DEFAULT_WEIGHTS,
  },
};

function showHelp() {
  console.log(`${COLOR.bold}Usage:${COLOR.reset}`);
  console.log(`  node ${process.argv[1]} <tier> [seed]`);
  console.log(`  node ${process.argv[1]} custom <numOps> <devices> [seed]`);
  console.log('');
  console.log(`${COLOR.bold}Tiers:${COLOR.reset}`);
  for (const [name, cfg] of Object.entries(TIERS)) {
    console.log(`  ${COLOR.cyan}${name}${COLOR.reset}: ${cfg.label} — ${cfg.numOps} ops, ${cfg.deviceCount} devices, verify every ${cfg.verifyInterval}`);
  }
  console.log('');
  console.log(`${COLOR.bold}Examples:${COLOR.reset}`);
  console.log(`  node ${process.argv[1]} smoke`);
  console.log(`  node ${process.argv[1]} regression 42`);
  console.log(`  node ${process.argv[1]} nightly`);
  console.log(`  node ${process.argv[1]} random 1000 3 42`);
  console.log(`  node ${process.argv[1]} custom 5000 5 123`);
}

async function main() {
  const tierName = (process.argv[2] || 'smoke').toLowerCase();
  const seed = parseInt(process.argv[3], 10) || Date.now();

  let config;

  if (tierName === 'custom') {
    const numOps = parseInt(process.argv[3], 10);
    const devices = parseInt(process.argv[4], 10);
    const customSeed = parseInt(process.argv[5], 10) || Date.now();
    if (!numOps || !devices) {
      showHelp();
      process.exit(1);
    }
    config = {
      label: `Custom (${numOps}×${devices})`,
      numOps,
      deviceCount: devices,
      verifyInterval: Math.max(50, Math.floor(numOps / 10)),
      weights: SimulationEngine.DEFAULT_WEIGHTS,
      seed: customSeed,
    };
  } else if (tierName === 'random') {
    const numOps = parseInt(process.argv[3], 10) || 750;
    const devices = parseInt(process.argv[4], 10) || 3;
    const randomSeed = parseInt(process.argv[5], 10) || Date.now();
    const scenario = new RandomScenario({ numOps, deviceCount: devices, seed: randomSeed });
    const result = await scenario.run();
    console.log(`  ${result.passed ? `${COLOR.green}ALL PASSED` : `${COLOR.red}FAILED`}${COLOR.reset}`);
    process.exit(result.passed ? 0 : 1);
    return;
  } else if (TIERS[tierName]) {
    config = { ...TIERS[tierName], seed };
  } else {
    console.error(`${COLOR.red}Unknown tier:${COLOR.reset} ${tierName}\n`);
    showHelp();
    process.exit(1);
  }

  console.log(`${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
  console.log(`${COLOR.bold}║              Stress Suite Runner                        ║${COLOR.reset}`);
  console.log(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}`);
  console.log(`\n  Tier:    ${COLOR.cyan}${config.label}${COLOR.reset}`);
  console.log(`  Seed:    ${config.seed}`);
  console.log(`  Ops:     ${config.numOps}`);
  console.log(`  Devices: ${config.deviceCount}`);
  console.log(`  Verify:  every ${config.verifyInterval} ops`);
  console.log(`  To reproduce: node ${process.argv[1]} ${tierName} ${config.seed}\n`);

  const engine = new SimulationEngine(config);
  try {
    await engine.init();
    const result = await engine.run();
    console.log(`  ${result.passed ? `${COLOR.green}ALL PASSED` : `${COLOR.red}FAILED`}${COLOR.reset}`);
    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.error(`${COLOR.red}Fatal:${COLOR.reset}`, err);
    process.exit(1);
  } finally {
    await engine.destroy();
  }
}

main();
