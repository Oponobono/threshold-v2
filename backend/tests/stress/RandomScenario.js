const SimulationEngine = require('./SimulationEngine');
const ConsistencyReport = require('../convergence/ConsistencyReport');

const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const RANDOM_WEIGHTS = {
  'create-subject': 10,
  'create-course': 10,
  'create-flashcard-deck': 7,
  'create-flashcard': 7,
  'update': 15,
  'delete': 10,
  'restore': 3,
  'sync': 8,
  'partial-sync': 5,
  'simultaneous-sync': 4,
  'kill': 4,
  'resume': 4,
  'inject-latency': 4,
  'inject-packet-loss': 3,
  'clear-perturbations': 3,
  'server-restart': 3,
};

const SEGMENT_WEIGHTS = {
  normal: null,
  heavy_perturbations: {
    'create-subject': 5,
    'create-course': 5,
    'create-flashcard-deck': 3,
    'create-flashcard': 3,
    'update': 8,
    'delete': 6,
    'restore': 2,
    'sync': 10,
    'partial-sync': 8,
    'simultaneous-sync': 6,
    'kill': 8,
    'resume': 8,
    'inject-latency': 8,
    'inject-packet-loss': 6,
    'clear-perturbations': 4,
    'server-restart': 6,
  },
  offline: {
    'create-subject': 12,
    'create-course': 12,
    'create-flashcard-deck': 8,
    'create-flashcard': 8,
    'update': 20,
    'delete': 12,
    'restore': 4,
    'sync': 2,
    'kill': 1,
    'resume': 2,
  },
};

class RandomScenario {
  constructor(opts = {}) {
    this.seed = opts.seed || Date.now();
    this.numOps = opts.numOps || 750;
    this.deviceCount = opts.deviceCount || 3;
    this.verifyInterval = opts.verifyInterval || Math.max(50, Math.floor(this.numOps / 10));
    this.label = opts.label || `RandomScenario — ${this.numOps}×${this.deviceCount}`;
    this._segments = opts.segments || [
      { name: 'normal', ops: Math.floor(this.numOps * 0.5), weights: null },
      { name: 'heavy_perturbations', ops: Math.floor(this.numOps * 0.25), weights: SEGMENT_WEIGHTS.heavy_perturbations },
      { name: 'offline', ops: Math.floor(this.numOps * 0.2), weights: SEGMENT_WEIGHTS.offline },
      { name: 'normal', ops: this.numOps - Math.floor(this.numOps * 0.95), weights: null },
    ];
    this.engine = null;
    this._errors = [];
  }

  async run() {
    console.log(`\n${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
    console.log(`${COLOR.bold}║        Random Scenario Generator                        ║${COLOR.reset}`);
    console.log(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}`);
    console.log(`  Seed: ${this.seed}`);
    console.log(`  Ops: ${this.numOps} across ${this.deviceCount} devices`);
    console.log(`  Segments:`);
    for (const seg of this._segments) {
      console.log(`    ${COLOR.cyan}${seg.name}${COLOR.reset}: ${seg.ops} ops`);
    }
    console.log(`  Verify every: ${this.verifyInterval} ops\n`);

    this.engine = new SimulationEngine({
      seed: this.seed,
      numOps: this.numOps,
      deviceCount: this.deviceCount,
      verifyInterval: this.verifyInterval,
      label: this.label,
    });
    await this.engine.init();

    const result = await this._runSegments();

    // Final ConsistencyReport
    console.log(`\n${COLOR.bold}═══ Final Consistency Report ═══${COLOR.reset}`);
    const report = new ConsistencyReport(`${this.label} — Final`);
    const auditor = await this.engine.env.createDevice('FinalAuditor');
    try {
      await auditor._pull();
      await report.run({ backendDb: this.engine.env.backendDb, devices: [auditor] });
      console.log(report.format());
      if (!report.pass()) {
        for (const e of report._errors) {
          this.engine.metrics.recordError(`Final consistency: ${e}`);
        }
      }
    } finally {
      await auditor.destroy();
    }

    result.convergenceScore = this.engine.metrics.convergenceScore;
    result.consistencyPass = report.pass();
    result.metrics = this.engine.metrics;
    result.errors = this._errors;
    result.passed = this._errors.length === 0 && report.pass();

    console.log(`\n${COLOR.bold}═══════════════════════════════════════════════════════════${COLOR.reset}`);
    const status = result.passed ? `${COLOR.green}ALL PASSED${COLOR.reset}` : `${COLOR.red}FAILED${COLOR.reset}`;
    console.log(`${COLOR.bold}  Result: ${status}${COLOR.reset}`);
    console.log(`${COLOR.bold}═══════════════════════════════════════════════════════════${COLOR.reset}\n`);

    console.log(this.engine.metrics.report(this.label));

    await this.engine.destroy();
    return result;
  }

  async _runSegments() {
    this.engine.metrics.start();
    let opIndex = 0;
    let segmentStart = 0;

    for (const segment of this._segments) {
      if (segment.ops <= 0) continue;
      const segmentEnd = segmentStart + segment.ops;
      console.log(`\n${COLOR.cyan}── Segment: ${segment.name} (ops ${segmentStart}–${segmentEnd}) ──${COLOR.reset}\n`);

      // Temporarily swap weights for this segment
      const originalWeights = this.engine.weights;
      if (segment.weights) {
        this.engine.generator.weights = segment.weights;
        this.engine.generator.totalWeight = Object.values(segment.weights).reduce((a, b) => a + b, 0);
      }

      for (let i = segmentStart; i < segmentEnd; i++) {
        const op = this.engine.generator.next(this.engine.deviceNames);
        try {
          await this.engine.runOp(op);
        } catch (err) {
          const msg = `Segment ${segment.name} op ${i} [${op.device}] ${op.operation} ${op.entityType || ''}: ${err.message}`;
          this._errors.push({ segment: segment.name, op: i, ...op, error: err.message });
          this.engine.metrics.recordError(msg);
          console.error(`  ${COLOR.red}ERROR${COLOR.reset} ${msg}`);
        }

        if ((i + 1) % this.engine.verifyInterval === 0 || i === segmentEnd - 1) {
          await this._checkpoint(i + 1);
        }
      }

      // Restore weights
      this.engine.generator.weights = originalWeights;
      this.engine.generator.totalWeight = Object.values(originalWeights).reduce((a, b) => a + b, 0);
      segmentStart = segmentEnd;
    }

    return { seed: this.seed, totalOps: this._errors.length };
  }

  async _checkpoint(opIndex) {
    console.log(`\n${COLOR.dim}── Checkpoint at op ${opIndex} ──${COLOR.reset}`);
    for (const name of this.engine.deviceNames) {
      try {
        if (this.engine.network.isOnline(name)) {
          await this.engine.devices[name].sync();
        }
      } catch (e) {
        const msg = `Sync error on ${name}: ${e.message}`;
        this.engine.metrics.recordError(msg);
        console.error(`  ${COLOR.red}${msg}${COLOR.reset}`);
      }
    }

    const report = new ConsistencyReport(`Op ${opIndex}`);
    const auditor = await this.engine.env.createDevice(`Auditor_${opIndex}`);
    try {
      await auditor._pull();
      await report.run({ backendDb: this.engine.env.backendDb, devices: [auditor] });
      const passed = report.pass();
      this.engine.metrics.recordCheckpoint(opIndex, passed, report._errors);
      if (!passed) {
        console.log(report.format());
        for (const e of report._errors) {
          this.engine.metrics.recordError(`Checkpoint ${opIndex}: ${e}`);
        }
      } else {
        console.log(`  ${COLOR.green}✓${COLOR.reset} Consistency: PASS\n`);
      }
    } finally {
      await auditor.destroy();
    }
  }
}

async function main() {
  const numOps = parseInt(process.argv[2], 10) || 750;
  const deviceCount = parseInt(process.argv[3], 10) || 3;
  const seed = parseInt(process.argv[4], 10) || Date.now();

  console.log(`${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
  console.log(`${COLOR.bold}║       Random Scenario — Stress Suite                    ║${COLOR.reset}`);
  console.log(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}`);
  console.log(`\n  Ops:     ${numOps}`);
  console.log(`  Devices: ${deviceCount}`);
  console.log(`  Seed:    ${seed}\n`);

  const scenario = new RandomScenario({ numOps, deviceCount, seed });
  const result = await scenario.run();
  process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`${COLOR.red}Fatal:${COLOR.reset}`, err);
    process.exit(1);
  });
}

module.exports = RandomScenario;
