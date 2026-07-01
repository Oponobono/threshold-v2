const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

class ConvergenceAssert {
  constructor(scenarioName) {
    this.name = scenarioName;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this._start = Date.now();
  }

  equal(actual, expected, msg) {
    if (actual === expected) {
      this.passed++;
      return;
    }
    this.failed++;
    this.errors.push(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  deepEqual(actual, expected, path = '') {
    if (actual === expected) return;
    if (actual == null || expected == null) {
      if (actual == null && expected == null) return;
      this.failed++;
      this.errors.push(`Mismatch at ${path}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
      return;
    }
    if (typeof actual !== 'object' || typeof expected !== 'object') {
      this.failed++;
      this.errors.push(`Mismatch at ${path}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
      return;
    }
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const k of keys) {
      if (k === 'created_at' || k === 'updated_at' || k === 'last_login' || k === 'deleted_at' || k === 'last_modified_by') continue;
      this.deepEqual(actual[k], expected[k], `${path}.${k}`);
    }
    if (this.errors.length === 0) this.passed++;
  }

  noQueue(device, label) {
    const pending = device.filter(i => i.status === 'pending');
    this.equal(pending.length, 0, `[${label}] sync_queue should be empty, got ${pending.length} pending`);
  }

  sameCount(label, backend, ...devices) {
    for (const d of devices) {
      if (d !== undefined) {
        this.equal(d.length, backend.length, `[${label}] count mismatch: backend=${backend.length}, device=${d.length}`);
      }
    }
  }

  sameEntities(label, entityListA, entityListB, labelA, labelB) {
    const mapA = {};
    for (const e of entityListA) mapA[e.id] = e;
    const mapB = {};
    for (const e of entityListB) mapB[e.id] = e;
    const allIds = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
    for (const id of allIds) {
      if (!mapA[id]) { this.failed++; this.errors.push(`[${label}] ${id} exists in ${labelB} but not in ${labelA}`); continue; }
      if (!mapB[id]) { this.failed++; this.errors.push(`[${label}] ${id} exists in ${labelA} but not in ${labelB}`); continue; }
      for (const key of Object.keys(mapA[id])) {
        if (['created_at', 'updated_at', 'deleted_at', 'last_login', 'version_number'].includes(key)) continue;
        this.deepEqual(mapA[id][key], mapB[id][key], `${label}/${id}/${key}`);
      }
    }
  }

  report() {
    const duration = ((Date.now() - this._start) / 1000).toFixed(2);
    const total = this.passed + this.failed;
    const status = this.failed === 0 ? `${COLOR.green}PASS${COLOR.reset}` : `${COLOR.red}FAIL${COLOR.reset}`;
    console.log(`  ${status} ${this.name} (${this.passed}/${total} assertions, ${duration}s)`);
    for (const err of this.errors.slice(0, 5)) {
      console.log(`    ${COLOR.red}✗${COLOR.reset} ${err}`);
    }
    if (this.errors.length > 5) {
      console.log(`    ${COLOR.dim}... and ${this.errors.length - 5} more errors${COLOR.reset}`);
    }
    return { passed: this.passed, failed: this.failed, errors: this.errors, name: this.name };
  }
}

module.exports = ConvergenceAssert;
