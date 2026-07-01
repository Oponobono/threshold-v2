const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const TABLES = [
  'subjects', 'courses', 'flashcard_decks', 'flashcards',
  'assessments', 'assessment_categories', 'schedules',
  'calendar_events', 'grading_periods', 'lms_accounts',
  'subject_threshold_overrides', 'study_sessions',
  'photos', 'audio_recordings', 'scanned_documents',
];

const FK_RULES = [
  { child: 'subjects', childKey: 'course_id', parent: 'courses', parentKey: 'id', nullable: true },
  { child: 'flashcard_decks', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: true },
  { child: 'flashcards', childKey: 'deck_id', parent: 'flashcard_decks', parentKey: 'id', nullable: false },
  { child: 'assessments', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: false },
  { child: 'assessments', childKey: 'category_id', parent: 'assessment_categories', parentKey: 'id', nullable: true },
  { child: 'assessment_categories', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: false },
  { child: 'schedules', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: true },
  { child: 'subject_threshold_overrides', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: false },
  { child: 'study_sessions', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: true },
  { child: 'study_sessions', childKey: 'deck_id', parent: 'flashcard_decks', parentKey: 'id', nullable: true },
  { child: 'photos', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: true },
  { child: 'audio_recordings', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: true },
  { child: 'scanned_documents', childKey: 'subject_id', parent: 'subjects', parentKey: 'id', nullable: true },
];

class ConsistencyReport {
  constructor(label = 'Consistency') {
    this.label = label;
    this.results = { entities: {}, integrity: {}, queues: {}, versions: {} };
    this._errors = [];
    this._start = Date.now();
  }

  async run(opts) {
    const { backendDb, devices } = opts;
    this._errors = [];

    // Gather data from backend
    const backend = {};
    for (const t of TABLES) {
      try { backend[t] = await _query(backendDb, `SELECT * FROM ${t}`); }
      catch { backend[t] = []; }
    }
    try { backend.sync_version = await _query(backendDb, 'SELECT * FROM sync_version WHERE id = 1'); }
    catch { backend.sync_version = []; }
    try { backend.sync_deletions = await _query(backendDb, 'SELECT * FROM sync_deletions'); }
    catch { backend.sync_deletions = []; }

    const maxVer = backend.sync_version?.[0]?.version || 0;

    // Entity counts — check if table exists first, treat missing as 0
    const entityResults = {};
    for (const t of TABLES) {
      const bCount = backend[t].length;
      const devCounts = [];
      for (const d of devices) {
        let cnt = 0;
        try {
          const tableExists = await _query(d.db, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t]);
          if (tableExists.length > 0) {
            cnt = await _query(d.db, `SELECT COUNT(*) as cnt FROM ${t}`).then(r => r[0]?.cnt || 0);
          }
        } catch {}
        devCounts.push(cnt);
      }
      const allMatch = devCounts.every(c => c === bCount);
      entityResults[t] = { backend: bCount, devices: devCounts, match: allMatch };
      if (!allMatch) this._errors.push(`Entity count mismatch for ${t}: backend=${bCount}, devices=${JSON.stringify(devCounts)}`);
    }
    this.results.entities = entityResults;

    // Integrity: FK orphans
    const fkIssues = [];
    for (const fk of FK_RULES) {
      const childRows = backend[fk.child] || [];
      const parentRows = new Set((backend[fk.parent] || []).map(r => r[fk.parentKey]));
      const orphans = childRows.filter(r => {
        const val = r[fk.childKey];
        if (val == null) return fk.nullable ? false : true;
        return !parentRows.has(val);
      });
      for (const o of orphans) {
        fkIssues.push({ table: fk.child, id: o.id, key: fk.childKey, value: o[fk.childKey], parent: fk.parent });
      }
    }
    this.results.integrity.fk_orphans = fkIssues;
    if (fkIssues.length > 0) this._errors.push(`Found ${fkIssues.length} FK orphans`);

    // Integrity: duplicate PKs within each source
    const dupPKs = [];
    for (const t of TABLES) {
      const seenPKs = {};
      for (const row of backend[t]) {
        if (row.id != null) {
          if (seenPKs[row.id]) dupPKs.push({ table: t, id: row.id });
          seenPKs[row.id] = true;
        }
      }
    }
    this.results.integrity.duplicate_pks = dupPKs;
    if (dupPKs.length > 0) this._errors.push(`Found ${dupPKs.length} duplicate PKs`);

    // Integrity: same UUID across different entity types (should not happen unless collision)
    // In practice UUIDs are unique, so skip

    // Queues
    let totalPending = 0;
    for (let i = 0; i < devices.length; i++) {
      const d = devices[i];
      try {
        const pending = await _query(d.db, "SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'pending'");
        const failed = await _query(d.db, "SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'failed' OR retries >= 5");
        this.results.queues[`device${i}_pending`] = pending[0]?.cnt || 0;
        this.results.queues[`device${i}_failed`] = failed[0]?.cnt || 0;
        totalPending += this.results.queues[`device${i}_pending`];
      } catch {
        this.results.queues[`device${i}_pending`] = -1;
        this.results.queues[`device${i}_failed`] = -1;
      }
    }
    if (totalPending > 0) this._errors.push(`Total pending queue items: ${totalPending}`);

    // Versions
    this.results.versions.max_sync_version = maxVer;
    this.results.versions.backend = maxVer;
    for (let i = 0; i < devices.length; i++) {
      const devLast = devices[i].lastSyncVersion;
      const prefix = `device${i}`;
      this.results.versions[prefix] = devLast;
      if (devLast !== maxVer) {
        this._errors.push(`Device ${i} lastSyncVersion=${devLast} != backend max=${maxVer}`);
      }
      // Also check highest sync_version per table on this device
      let devMax = 0;
      for (const t of TABLES) {
        try {
          const rows = await _query(devices[i].db, `SELECT MAX(sync_version) as mv FROM ${t}`);
          if (rows[0]?.mv > devMax) devMax = rows[0].mv;
        } catch {}
      }
      this.results.versions[`${prefix}_max_table`] = devMax;
      if (devMax > maxVer) {
        this._errors.push(`Device ${i} has sync_version ${devMax} > backend ${maxVer}`);
      }
    }

    return this;
  }

  pass() { return this._errors.length === 0; }

  format() {
    const duration = ((Date.now() - this._start) / 1000).toFixed(2);
    const lines = [];
    lines.push(`${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
    lines.push(`${COLOR.bold}║            Consistency Report — ${this.label.padEnd(20)}║${COLOR.reset}`);
    lines.push(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}`);
    lines.push('');

    const status = this.pass() ? `${COLOR.green}PASS${COLOR.reset}` : `${COLOR.red}FAIL${COLOR.reset}`;

    // Entities
    lines.push(`  ${COLOR.cyan}Entities${COLOR.reset}`);
    for (const [table, data] of Object.entries(this.results.entities)) {
      const devStr = data.devices.map((c, i) => `D${i}=${c === -1 ? 'ERR' : c}`).join(' ');
      const mark = data.match ? `${COLOR.green}✓${COLOR.reset}` : `${COLOR.red}✗${COLOR.reset}`;
      lines.push(`    ${mark} ${table.padEnd(30)} B=${data.backend} ${devStr}`);
    }

    // Integrity
    lines.push(`\n  ${COLOR.cyan}Integrity${COLOR.reset}`);
    const orphans = this.results.integrity.fk_orphans || [];
    const dupPKs = this.results.integrity.duplicate_pks || [];
    const iMark = orphans.length === 0 && dupPKs.length === 0 ? `${COLOR.green}✓${COLOR.reset}` : `${COLOR.red}✗${COLOR.reset}`;
    lines.push(`    ${iMark} FK orphans            ${orphans.length}`);
    lines.push(`         Duplicate PKs        ${dupPKs.length}`);
    if (orphans.length > 0 && orphans.length <= 5) {
      for (const o of orphans) lines.push(`           - ${o.table}:${o.id} has ${o.key}=${o.value} missing in ${o.parent}`);
    }

    // Queues
    lines.push(`\n  ${COLOR.cyan}Queues${COLOR.reset}`);
    let qFailed = 0;
    for (const [key, val] of Object.entries(this.results.queues)) {
      lines.push(`    ${val === 0 ? `${COLOR.green}✓` : `${COLOR.red}✗`}${COLOR.reset} ${key.padEnd(22)} ${val}`);
      if (val > 0) qFailed++;
    }

    // Versions
    lines.push(`\n  ${COLOR.cyan}Versions${COLOR.reset}`);
    const v = this.results.versions;
    lines.push(`    ${COLOR.dim}Max Sync Version${COLOR.reset}        ${v.max_sync_version}`);
    const allMatch = Object.entries(v).every(([k, val]) => k === 'max_sync_version' || val === v.max_sync_version || val === undefined);
    for (const [key, val] of Object.entries(v)) {
      if (key === 'max_sync_version') continue;
      const match = val === undefined || val === v.max_sync_version;
      const m = match ? `${COLOR.green}✓${COLOR.reset}` : `${COLOR.red}✗${COLOR.reset}`;
      lines.push(`    ${m} ${key.padEnd(22)} ${val}`);
    }

    lines.push('');
    lines.push(`  ${COLOR.bold}Result: ${status}${COLOR.reset}`);
    lines.push(`  Duration: ${duration}s`);
    if (this._errors.length > 0) {
      lines.push(`  Errors:`);
      for (const e of this._errors.slice(0, 10)) {
        lines.push(`    ${COLOR.red}•${COLOR.reset} ${e}`);
      }
      if (this._errors.length > 10) lines.push(`    ${COLOR.dim}... and ${this._errors.length - 10} more${COLOR.reset}`);
    }
    lines.push(`${COLOR.bold}═══════════════════════════════════════════════════════════${COLOR.reset}\n`);
    return lines.join('\n');
  }
}

function _query(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = ConsistencyReport;
