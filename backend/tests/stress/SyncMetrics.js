const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const OP_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'];

class SyncMetrics {
  constructor() {
    this._syncs = [];
    this._ops = {};
    for (const t of OP_TYPES) this._ops[t] = [];
    this._conflicts = 0;
    this._discardedByVersion = 0;
    this._queueDepths = [];
    this._retries = [];
    this._checkpoints = [];
    this._errors = [];
    this._startTime = null;
    this._totalOps = 0;
  }

  start() {
    this._startTime = Date.now();
  }

  recordSync(device, durationMs) {
    this._syncs.push({ device, durationMs, ts: Date.now() });
  }

  recordOp(type, durationMs) {
    if (this._ops[type]) this._ops[type].push(durationMs);
  }

  recordConflict() {
    this._conflicts++;
  }

  recordDiscarded() {
    this._discardedByVersion++;
  }

  recordQueueDepth(depth) {
    this._queueDepths.push({ depth, ts: Date.now() });
  }

  recordRetries(count) {
    this._retries.push(count);
  }

  recordCheckpoint(opIndex, passed, errors) {
    this._checkpoints.push({ opIndex, passed, errors: errors || [] });
  }

  recordError(msg) {
    this._errors.push(msg);
  }

  recordOpCount(n) {
    this._totalOps += n;
  }

  get convergenceScore() {
    if (this._checkpoints.length === 0) return 100;
    const passed = this._checkpoints.filter(c => c.passed).length;
    return Math.round((passed / this._checkpoints.length) * 100);
  }

  get totalSyncs() {
    return this._syncs.length;
  }

  get avgSyncTime() {
    if (this._syncs.length === 0) return 0;
    return this._syncs.reduce((s, x) => s + x.durationMs, 0) / this._syncs.length;
  }

  get p95SyncTime() {
    if (this._syncs.length === 0) return 0;
    const sorted = [...this._syncs].sort((a, b) => a.durationMs - b.durationMs);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)].durationMs;
  }

  get maxSyncTime() {
    if (this._syncs.length === 0) return 0;
    return Math.max(...this._syncs.map(s => s.durationMs));
  }

  get minSyncTime() {
    if (this._syncs.length === 0) return 0;
    return Math.min(...this._syncs.map(s => s.durationMs));
  }

  get maxQueueDepth() {
    if (this._queueDepths.length === 0) return 0;
    return Math.max(...this._queueDepths.map(q => q.depth));
  }

  get avgRetries() {
    if (this._retries.length === 0) return 0;
    const sum = this._retries.reduce((s, x) => s + x, 0);
    return sum / this._retries.length;
  }

  get maxRetries() {
    if (this._retries.length === 0) return 0;
    return Math.max(...this._retries);
  }

  avgOpTime(type) {
    const arr = this._ops[type];
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((s, x) => s + x, 0) / arr.length;
  }

  p95OpTime(type) {
    const arr = this._ops[type];
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  }

  get totalOps() {
    return this._totalOps;
  }

  opCount(type) {
    const arr = this._ops[type];
    return arr ? arr.length : 0;
  }

  get totalConflicts() {
    return this._conflicts;
  }

  get totalDiscarded() {
    return this._discardedByVersion;
  }

  get totalCheckpoints() {
    return this._checkpoints.length;
  }

  get totalErrors() {
    return this._errors.length;
  }

  _fmtMs(ms) {
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    return Math.round(ms) + 'ms';
  }

  _fmtPct(num) {
    return num.toFixed(1) + '%';
  }

  _fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  _pad(s, len) {
    return String(s).padEnd(len);
  }

  report(label = 'Sync Metrics') {
    const duration = this._startTime ? ((Date.now() - this._startTime) / 1000).toFixed(2) : '-';
    const lines = [];
    lines.push(`${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
    lines.push(`${COLOR.bold}║           ${label.padEnd(47)}║${COLOR.reset}`);
    lines.push(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}`);
    lines.push('');
    lines.push(`  ${COLOR.cyan}Summary${COLOR.reset}`);
    lines.push(`    Convergence Score         ${this.convergenceScore === 100 ? COLOR.green : COLOR.yellow}${this.convergenceScore}%${COLOR.reset}`);
    lines.push(`    Run Duration             ${duration}s`);
    lines.push(`    Total Operations         ${this._fmtNum(this.totalOps)}`);
    lines.push(`    Total Syncs              ${this._fmtNum(this.totalSyncs)}`);
    lines.push(`    Total Errors             ${this.totalErrors === 0 ? COLOR.green : COLOR.red}${this._fmtNum(this.totalErrors)}${COLOR.reset}`);
    lines.push(`    Checkpoints              ${this.totalCheckpoints}`);
    lines.push('');
    lines.push(`  ${COLOR.cyan}Sync Timing${COLOR.reset}`);
    lines.push(`    Average                  ${this._fmtMs(this.avgSyncTime)}`);
    lines.push(`    P95                      ${this._fmtMs(this.p95SyncTime)}`);
    lines.push(`    Min                      ${this._fmtMs(this.minSyncTime)}`);
    lines.push(`    Max                      ${this._fmtMs(this.maxSyncTime)}`);
    lines.push('');
    lines.push(`  ${COLOR.cyan}Queue${COLOR.reset}`);
    lines.push(`    Max Queue Depth          ${this.maxQueueDepth}`);
    lines.push(`    Average Retries          ${this.avgRetries.toFixed(2)}`);
    lines.push(`    Max Retries              ${this.maxRetries}`);
    lines.push('');
    lines.push(`  ${COLOR.cyan}Conflicts & Versioning${COLOR.reset}`);
    lines.push(`    Conflicts (409)          ${this.totalConflicts}`);
    lines.push(`    Discarded by Version     ${this.totalDiscarded}`);
    lines.push('');
    lines.push(`  ${COLOR.cyan}Avg Time per Operation${COLOR.reset}`);
    for (const t of OP_TYPES) {
      const count = this.opCount(t);
      const avg = this.avgOpTime(t);
      const p95 = this.p95OpTime(t);
      const countStr = this._pad(`(${this._fmtNum(count)})`, 12);
      lines.push(`    ${this._pad(t, 8)} ${countStr} avg=${this._fmtMs(avg)}  P95=${this._fmtMs(p95)}`);
    }
    lines.push('');
    return lines.join('\n');
  }
}

module.exports = SyncMetrics;
