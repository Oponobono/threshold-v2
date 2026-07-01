const TestEnvironment = require('../convergence/TestEnvironment');
const DeviceSimulator = require('../convergence/DeviceSimulator');
const ConsistencyReport = require('../convergence/ConsistencyReport');
const SyncMetrics = require('./SyncMetrics');

const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function createRng(seed) {
  let s = seed | 0;
  return () => {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function generateDeviceNames(count) {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

const UPDATE_GENERATORS = {
  'photo': (rng) => ({
    ocr_text: pick(rng, ['Extracted text from whiteboard', 'Notes from lecture', 'Diagram explanation', 'Formula derivation', 'Lab results summary', 'Book excerpt', 'Handwritten notes']),
    es_favorita: pick(rng, [0, 1]),
  }),
};

const ENTITY_GENERATORS = {
  subject: {
    generate: (rng) => ({
      name: pick(rng, [
        'Math', 'Physics', 'Chemistry', 'Biology', 'History',
        'Literature', 'Art', 'CS', 'Engineering', 'Economics',
        'Psychology', 'Philosophy', 'Music', 'Geology', 'Astronomy',
      ]),
    }),
  },
  course: {
    generate: (rng) => ({
      name: pick(rng, [
        'Calculus I', 'Physics 101', 'Organic Chemistry', 'Biology Lab',
        'World History', 'English Literature', 'Art History',
        'Data Structures', 'Thermodynamics', 'Macroeconomics',
        'Linear Algebra', 'Quantum Mechanics', 'Genetics',
        'Microeconomics', 'Cognitive Psychology',
      ]),
      platform: pick(rng, ['Coursera', 'edX', 'Udemy', 'Khan Academy', 'MIT OCW']),
    }),
  },
  'flashcard-deck': {
    generate: (rng) => ({
      title: pick(rng, [
        'Chapter 1', 'Exam Review', 'Key Terms', 'Final Prep',
        'Midterm', 'Quiz 3', 'Unit 2', 'Flashcards Set',
        'Vocabulary', 'Formulas',
      ]),
    }),
  },
  flashcard: {
    generate: (rng, deckId) => ({
      front: pick(rng, [
        'What is the derivative of x^2?', 'Define entropy',
        'What is Newton\'s second law?', 'Capital of France',
        'E = mc^2 explains what?', 'What is a linked list?',
        'Define photosynthesis', 'What is the Pythagorean theorem?',
        'Who wrote Macbeth?', 'What is supply and demand?',
      ]),
      back: pick(rng, [
        '2x', 'A measure of disorder', 'F = ma', 'Paris',
        'Mass-energy equivalence', 'A linear data structure',
        'Conversion of light to chemical energy', 'a² + b² = c²',
        'William Shakespeare', 'An economic model of pricing',
      ]),
      deck_id: deckId,
    }),
  },
  photo: {
    generate: (rng, subjectId) => ({
      name: pick(rng, ['Screenshot', 'Whiteboard', 'Diagram', 'Notes Page', 'Graph', 'Chart', 'Formula Sheet', 'Mind Map']),
      subject_id: subjectId || '00000000-0000-0000-0000-000000000000',
      local_uri: `/tmp/test_photos/${rng().toString(36).slice(2, 8)}.jpg`,
    }),
  },
  'audio-recording': {
    generate: (rng) => ({
      name: pick(rng, ['Lecture', 'Discussion', 'Explanation', 'Review', 'Q&A Session', 'Summary', 'Tutorial']),
      local_uri: `/tmp/test_audio/${rng().toString(36).slice(2, 8)}.m4a`,
    }),
  },
  'audio-transcript': {
    generate: (rng, recordingId) => ({
      recording_id: recordingId,
      transcript_text: pick(rng, [
        'En esta lección aprendimos sobre los fundamentos de la termodinámica...',
        'La derivada de una función representa la tasa de cambio instantánea...',
        'La fotosíntesis convierte la energía luminosa en energía química...',
        'La Segunda Guerra Mundial comenzó en 1939 con la invasión de Polonia...',
        'La entropía es una medida del desorden en un sistema termodinámico...',
        'El teorema de Pitágoras establece que a² + b² = c²...',
        'La estructura de datos de lista enlazada permite inserción y eliminación eficientes...',
      ]),
    }),
  },
  'scanned-document': {
    generate: (rng) => ({
      name: pick(rng, ['Syllabus', 'Assignment', 'Study Guide', 'Practice Test', 'Reading', 'Notes', 'Lab Report']),
      local_uri: `/tmp/test_docs/${rng().toString(36).slice(2, 8)}.pdf`,
      file_path: `/tmp/test_docs/${rng().toString(36).slice(2, 8)}.pdf`,
    }),
  },
};

const ENTITY_TYPES = Object.keys(ENTITY_GENERATORS).filter(t => t !== 'audio-transcript'); // audio-transcript is created only via dependency, no independent UPDATE/DELETE

const DEFAULT_WEIGHTS = {
  'create-subject': 10,
  'create-course': 10,
  'create-flashcard-deck': 7,
  'create-flashcard': 7,
  'create-photo': 5,
  'create-audio-recording': 4,
  'create-audio-transcript': 3,
  'create-scanned-document': 4,
  'update': 16,
  'delete': 10,
  'restore': 3,
  'sync': 8,
  'partial-sync': 3,
  'simultaneous-sync': 3,
  'kill': 2,
  'resume': 2,
  'inject-latency': 2,
  'inject-packet-loss': 2,
  'clear-perturbations': 2,
  'server-restart': 2,
};

const LIGHT_WEIGHTS = {
  'create-subject': 12,
  'create-course': 12,
  'create-flashcard-deck': 8,
  'create-flashcard': 8,
  'create-photo': 4,
  'create-audio-recording': 3,
  'create-audio-transcript': 2,
  'create-scanned-document': 3,
  'update': 18,
  'delete': 14,
  'restore': 4,
  'sync': 12,
  'kill': 1,
  'resume': 1,
};

class RandomOperationGenerator {
  constructor(seed, weights = DEFAULT_WEIGHTS) {
    this.rng = createRng(seed);
    this.weights = weights;
    this.totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    this.opsCount = 0;
    this._knownIds = new Map();
    this._deletedIds = new Map();
  }

  trackCreate(entityType, id) {
    if (!this._knownIds.has(entityType)) this._knownIds.set(entityType, new Set());
    this._knownIds.get(entityType).add(id);
    this._deletedIds.get(entityType)?.delete(id);
  }

  trackDelete(entityType, id) {
    this._knownIds.get(entityType)?.delete(id);
    if (!this._deletedIds.has(entityType)) this._deletedIds.set(entityType, new Set());
    this._deletedIds.get(entityType).add(id);
  }

  trackRestore(entityType, id) {
    this._deletedIds.get(entityType)?.delete(id);
    if (!this._knownIds.has(entityType)) this._knownIds.set(entityType, new Set());
    this._knownIds.get(entityType).add(id);
  }

  next(deviceNames) {
    this.opsCount++;
    const roll = this.rng() * this.totalWeight;
    const device = pick(this.rng, deviceNames);

    let cumulative = 0;
    let operation = null;
    for (const [op, weight] of Object.entries(this.weights)) {
      cumulative += weight;
      if (roll < cumulative) { operation = op; break; }
    }
    if (!operation) operation = 'sync';

    if (operation === 'kill') {
      return { device, operation: 'kill', entityType: null, id: null, data: null, meta: { target: pick(this.rng, deviceNames) } };
    }

    if (operation === 'resume') {
      return { device, operation: 'resume', entityType: null, id: null, data: null, meta: { target: pick(this.rng, deviceNames) } };
    }

    if (operation === 'server-restart') {
      return { device, operation: 'server-restart', entityType: null, id: null, data: null, meta: {} };
    }

    if (operation === 'simultaneous-sync') {
      return { device, operation: 'simultaneous-sync', entityType: null, id: null, data: null, meta: {} };
    }

    if (operation === 'partial-sync') {
      const subType = pick(this.rng, ['push-only', 'pull-only']);
      return { device, operation: 'partial-sync', entityType: null, id: null, data: null, meta: { subType } };
    }

    if (operation === 'inject-latency') {
      const target = pick(this.rng, deviceNames);
      const latencyMs = Math.floor(this.rng() * 490) + 10;
      return { device, operation: 'inject-latency', entityType: null, id: null, data: null, meta: { target, latencyMs } };
    }

    if (operation === 'inject-packet-loss') {
      const target = pick(this.rng, deviceNames);
      const rate = (Math.floor(this.rng() * 26) + 5) / 100;
      return { device, operation: 'inject-packet-loss', entityType: null, id: null, data: null, meta: { target, rate } };
    }

    if (operation === 'clear-perturbations') {
      return { device, operation: 'clear-perturbations', entityType: null, id: null, data: null, meta: {} };
    }

    if (operation === 'sync') {
      return { device, operation, entityType: null, id: null, data: null, meta: {} };
    }

    if (operation === 'update' || operation === 'delete') {
      const typesWithEntities = ENTITY_TYPES.filter(t => (this._knownIds.get(t)?.size || 0) > 0);
      if (typesWithEntities.length === 0) return this.next(deviceNames);
      const entityType = pick(this.rng, typesWithEntities);
      const ids = [...this._knownIds.get(entityType)];
      const id = pick(this.rng, ids);

      if (operation === 'delete') {
        return { device, operation: 'delete', entityType, id, data: null, meta: {} };
      }

      let data;
      if (UPDATE_GENERATORS[entityType]) {
        data = UPDATE_GENERATORS[entityType](this.rng);
      } else {
        const gen = ENTITY_GENERATORS[entityType];
        data = gen.generate(this.rng);
      }
      return { device, operation: 'update', entityType, id, data, meta: {} };
    }

    if (operation === 'restore') {
      const typesWithDeleted = ENTITY_TYPES.filter(t => (this._deletedIds.get(t)?.size || 0) > 0);
      if (typesWithDeleted.length === 0) return this.next(deviceNames);
      const entityType = pick(this.rng, typesWithDeleted);
      const ids = [...this._deletedIds.get(entityType)];
      const id = pick(this.rng, ids);
      let data;
      if (entityType === 'flashcard') {
        const deckIds = this._knownIds.get('flashcard-deck');
        if (!deckIds || deckIds.size === 0) return this.next(deviceNames);
        data = ENTITY_GENERATORS.flashcard.generate(this.rng, pick(this.rng, [...deckIds]));
      } else {
        data = ENTITY_GENERATORS[entityType].generate(this.rng);
      }
      return { device, operation: 'restore', entityType, id, data, meta: {} };
    }

    const OP_ENTITY = {
      'create-subject': 'subject',
      'create-course': 'course',
      'create-flashcard-deck': 'flashcard-deck',
      'create-flashcard': 'flashcard',
      'create-photo': 'photo',
      'create-audio-recording': 'audio-recording',
      'create-audio-transcript': 'audio-transcript',
      'create-scanned-document': 'scanned-document',
    };
    const entityType = OP_ENTITY[operation];

    const gen = ENTITY_GENERATORS[entityType];
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    let data = gen.generate(this.rng);

    if (entityType === 'flashcard') {
      const deckIds = this._knownIds.get('flashcard-deck');
      if (!deckIds || deckIds.size === 0) return this.next(deviceNames);
      const deckId = pick(this.rng, [...deckIds]);
      data = gen.generate(this.rng, deckId);
    } else if (entityType === 'photo') {
      const subjectIds = this._knownIds.get('subject');
      if (!subjectIds || subjectIds.size === 0) return this.next(deviceNames);
      const subjectId = pick(this.rng, [...subjectIds]);
      data = gen.generate(this.rng, subjectId);
    } else if (entityType === 'audio-transcript') {
      const recordingIds = this._knownIds.get('audio-recording');
      if (!recordingIds || recordingIds.size === 0) return this.next(deviceNames);
      const recordingId = pick(this.rng, [...recordingIds]);
      data = gen.generate(this.rng, recordingId);
    }

    return { device, operation: 'create', entityType, id, data, meta: {} };
  }
}

class NetworkController {
  constructor() {
    this._online = new Map();
  }

  setOnline(device, state) {
    this._online.set(device, state);
  }

  isOnline(device) {
    if (!this._online.has(device)) return true;
    return this._online.get(device);
  }

  kill(device) {
    this._online.set(device, false);
  }

  resume(device) {
    this._online.set(device, true);
  }

  isConnected(device) {
    return this.isOnline(device);
  }
}

class SimulationEngine {
  constructor(opts = {}) {
    this.seed = opts.seed || Date.now();
    this.numOps = opts.numOps || 500;
    this.verifyInterval = opts.verifyInterval || 100;
    this.deviceCount = opts.deviceCount || 3;
    this.deviceNames = generateDeviceNames(this.deviceCount);
    this.weights = opts.weights || DEFAULT_WEIGHTS;
    this.label = opts.label || `Stress Suite — Seed ${this.seed}`;
    this.rng = createRng(this.seed);
    this.env = null;
    this.devices = {};
    this.generator = null;
    this.network = new NetworkController();
    this.metrics = new SyncMetrics();
    this._errors = [];
  }

  async init() {
    this.env = new TestEnvironment();
    await this.env.start();
    for (const name of this.deviceNames) {
      this.devices[name] = await this.env.createDevice(name);
      this.devices[name].setMetrics(this.metrics);
      this.network.setOnline(name, true);
    }
    this.generator = new RandomOperationGenerator(this.seed, this.weights);
    return this;
  }

  async runOp(op) {
    const deviceObj = this.devices[op.device];
    if (!deviceObj) return;

    if (op.operation === 'kill') {
      this.network.kill(op.meta?.target || op.device);
      console.log(`  [network] ${op.meta?.target || op.device} killed`);
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'resume') {
      this.network.resume(op.meta?.target || op.device);
      console.log(`  [network] ${op.meta?.target || op.device} resumed`);
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'server-restart') {
      console.log(`  [network] Server restarting...`);
      const newUrl = await this.env.restart();
      for (const d of Object.values(this.devices)) {
        d.backendUrl = newUrl;
      }
      for (const [name, d] of Object.entries(this.devices)) {
        if (this.network.isOnline(name)) {
          try { await d.sync(); } catch {}
        }
      }
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'simultaneous-sync') {
      const online = Object.entries(this.devices).filter(([name]) => this.network.isOnline(name));
      if (online.length >= 2) {
        console.log(`  [network] Simultaneous sync on ${online.map(([n]) => n).join(', ')}`);
        await Promise.all(online.map(([_, d]) => d.sync()));
      }
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'partial-sync') {
      if (!this.network.isOnline(op.device)) return;
      if (op.meta?.subType === 'push-only') {
        await deviceObj.syncPushOnly();
      } else {
        await deviceObj.syncPullOnly();
      }
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'inject-latency') {
      const target = this.devices[op.meta?.target];
      if (target) {
        target.setNetworkConditions(op.meta.latencyMs, target._packetLossRate);
        console.log(`  [perturbation] ${op.meta.target} latency=${op.meta.latencyMs}ms`);
      }
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'inject-packet-loss') {
      const target = this.devices[op.meta?.target];
      if (target) {
        target.setNetworkConditions(target._latencyMs, op.meta.rate);
        console.log(`  [perturbation] ${op.meta.target} packet_loss=${(op.meta.rate * 100).toFixed(0)}%`);
      }
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'clear-perturbations') {
      for (const d of Object.values(this.devices)) {
        d.setNetworkConditions(0, 0);
      }
      console.log(`  [perturbation] All devices reset (latency=0, packet_loss=0)`);
      this.metrics.recordOpCount(1);
      return;
    }

    if (op.operation === 'sync') {
      if (this.network.isOnline(op.device)) {
        await deviceObj.sync();
      }
      this.metrics.recordOpCount(1);
      return;
    }

    // CRUD operations
    const dbOp = op.operation === 'restore' ? 'CREATE' : op.operation.toUpperCase();

    await deviceObj.op(op.entityType, dbOp, op.id, op.data || {});

    if (this.network.isOnline(op.device)) {
      await deviceObj.sync();
    }

    if (op.operation === 'create') this.generator.trackCreate(op.entityType, op.id);
    else if (op.operation === 'delete') this.generator.trackDelete(op.entityType, op.id);
    else if (op.operation === 'restore') this.generator.trackRestore(op.entityType, op.id);

    this.metrics.recordOpCount(1);
  }

  async run() {
    this.metrics.start();
    console.log(`\n${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
    console.log(`${COLOR.bold}║ ${this.label.padEnd(51)}║${COLOR.reset}`);
    console.log(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}`);
    console.log(`${COLOR.dim}  Devices: ${this.deviceNames.join(', ')} (${this.deviceCount})`);
    console.log(`  Operations: ${this.numOps}`);
    console.log(`  Verify every: ${this.verifyInterval} ops`);
    console.log(`  Seed: ${this.seed}${COLOR.reset}\n`);

    for (let i = 0; i < this.numOps; i++) {
      const op = this.generator.next(this.deviceNames);
      try {
        await this.runOp(op);
      } catch (err) {
        const msg = `Op ${i} [${op.device}] ${op.operation} ${op.entityType || ''}: ${err.message}`;
        this._errors.push({ op: i, ...op, error: err.message });
        this.metrics.recordError(msg);
        console.error(`  ${COLOR.red}ERROR${COLOR.reset} ${msg}`);
      }

      if ((i + 1) % this.verifyInterval === 0 || i === this.numOps - 1) {
        console.log(`\n${COLOR.dim}── Checkpoint at op ${i + 1} ──${COLOR.reset}`);
        for (const name of this.deviceNames) {
          try {
            if (this.network.isOnline(name)) {
              await this.devices[name].sync();
            }
          } catch (e) {
            const msg = `Sync error on ${name}: ${e.message}`;
            this.metrics.recordError(msg);
            console.error(`  ${COLOR.red}${msg}${COLOR.reset}`);
          }
        }

        const report = new ConsistencyReport(`Op ${i + 1}`);
        const auditor = await this.env.createDevice(`Auditor_${i}`);
        try {
          await auditor._pull();
          await report.run({ backendDb: this.env.backendDb, devices: [auditor] });
          const passed = report.pass();
          this.metrics.recordCheckpoint(i + 1, passed, report._errors);
          if (!passed) {
            console.log(report.format());
            for (const e of report._errors) {
              this.metrics.recordError(`Checkpoint ${i + 1}: ${e}`);
            }
          } else {
            console.log(`  ${COLOR.green}✓${COLOR.reset} Consistency: PASS\n`);
          }
        } finally {
          await auditor.destroy();
        }
      }
    }

    const result = {
      seed: this.seed,
      metrics: this.metrics,
      errors: this._errors,
      passed: this._errors.length === 0 && this.metrics.convergenceScore === 100,
    };

    console.log(`\n${COLOR.bold}═══════════════════════════════════════════════════════════${COLOR.reset}`);
    const status = result.passed ? `${COLOR.green}ALL PASSED${COLOR.reset}` : `${COLOR.red}FAILED${COLOR.reset}`;
    console.log(`${COLOR.bold}  Result: ${status}${COLOR.reset}`);
    console.log(`${COLOR.bold}═══════════════════════════════════════════════════════════${COLOR.reset}\n`);

    console.log(this.metrics.report(this.label));

    return result;
  }

  async destroy() {
    for (const d of Object.values(this.devices)) {
      try { await d.destroy(); } catch {}
    }
    await this.env.stop();
  }
}

module.exports = SimulationEngine;
module.exports.DEFAULT_WEIGHTS = DEFAULT_WEIGHTS;
module.exports.LIGHT_WEIGHTS = LIGHT_WEIGHTS;
