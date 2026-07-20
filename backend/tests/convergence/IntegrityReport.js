/**
 * IntegrityReport — Pre-import validator for restore payloads.
 *
 * Validates a CloudItemsResponse JSON payload before importing into SQLite:
 *   1. Schema — required fields per entity category
 *   2. Integrity — FK orphans within the payload, duplicate PKs
 *   3. Conflicts — IDs already present in local DB (optional)
 *
 * Reuses the same FK_RULES concept as ConsistencyReport but operates on
 * in-memory JSON instead of SQLite queries.
 */

const COLOR = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const REQUIRED_FIELDS = {
  photos:          ['id', 'cloud_url'],
  audio:           ['id', 'cloud_url'],
  docs:            ['id', 'cloud_url'],
  transcripts:     ['id'],
  assessmentFiles: ['id', 'cloud_url'],
  aiChats:         ['id'],
  flashcardDecks:  ['id', 'cloud_url'],
  userPreferences: ['key', 'cloud_url'],
};

const PAYLOAD_FK_RULES = [
  {
    childCategory: 'transcripts',
    childKey: 'recording_id',
    parentCategory: 'audio',
    parentKey: 'id',
    filter: (item) => item.transcript_type === 'audio',
    nullable: false,
    desc: 'audio_transcript → audio_recording',
  },
];

class IntegrityReport {
  constructor(label = 'Restore') {
    this.label = label;
    this._start = Date.now();
    this._errors = [];
    this.results = {
      schema: { checked: 0, errors: [] },
      integrity: { fk_orphans: [], duplicate_pks: [] },
      conflicts: { already_exists: [] },
      summary: { total_items: 0, categories: {} },
    };
  }

  validate(payload, localDb = null) {
    this._errors = [];
    this.results = {
      schema: { checked: 0, errors: [] },
      integrity: { fk_orphans: [], duplicate_pks: [] },
      conflicts: { already_exists: [] },
      summary: { total_items: 0, categories: {} },
    };
    this._start = Date.now();

    if (!payload || typeof payload !== 'object') {
      this._errors.push('Payload is null or not an object');
      return this;
    }

    this._validateSchema(payload);
    this._validateFKIntegrity(payload);
    this._validateDuplicates(payload);

    return this;
  }

  _validateSchema(payload) {
    for (const [category, fields] of Object.entries(REQUIRED_FIELDS)) {
      const items = Array.isArray(payload[category]) ? payload[category] : [];
      this.results.summary.categories[category] = items.length;
      this.results.summary.total_items += items.length;

      for (const item of items) {
        for (const field of fields) {
          const val = item[field];
          if (val == null || val === '') {
            const err = `${category}[${item.id || '?'}]: missing '${field}'`;
            this.results.schema.errors.push(err);
            this._errors.push(err);
          }
          this.results.schema.checked++;
        }
      }
    }
  }

  _validateFKIntegrity(payload) {
    for (const rule of PAYLOAD_FK_RULES) {
      const childItems = (Array.isArray(payload[rule.childCategory]) ? payload[rule.childCategory] : [])
        .filter(rule.filter ? (item) => rule.filter(item) : () => true);
      const parentItems = Array.isArray(payload[rule.parentCategory]) ? payload[rule.parentCategory] : [];
      const parentIds = new Set(parentItems.map((p) => p[rule.parentKey]));

      for (const child of childItems) {
        const val = child[rule.childKey];
        if (val == null) {
          if (!rule.nullable) {
            this.results.integrity.fk_orphans.push({
              category: rule.childCategory, id: child.id,
              key: rule.childKey, value: null,
              parentCategory: rule.parentCategory,
            });
            this._errors.push(`${rule.desc}: id=${child.id} null ${rule.childKey}`);
          }
          continue;
        }
        if (!parentIds.has(val)) {
          this.results.integrity.fk_orphans.push({
            category: rule.childCategory, id: child.id,
            key: rule.childKey, value: val,
            parentCategory: rule.parentCategory,
          });
          this._errors.push(`${rule.desc}: id=${child.id} ${rule.childKey}=${val} not in ${rule.parentCategory}`);
        }
      }
    }
  }

  _validateDuplicates(payload) {
    for (const [category] of Object.entries(REQUIRED_FIELDS)) {
      const items = Array.isArray(payload[category]) ? payload[category] : [];
      const seen = new Set();
      for (const item of items) {
        const pk = category === 'userPreferences' ? item.key : item.id;
        if (pk != null) {
          if (seen.has(pk)) {
            this.results.integrity.duplicate_pks.push({ category, id: pk });
            this._errors.push(`${category}: duplicate pk=${pk}`);
          }
          seen.add(pk);
        }
      }
    }
  }

  pass() {
    return this._errors.length === 0;
  }

  format() {
    const duration = ((Date.now() - this._start) / 1000).toFixed(3);
    const lines = [];
    lines.push(`${COLOR.bold}╔══════════════════════════════════════════════════════════╗${COLOR.reset}`);
    lines.push(`${COLOR.bold}║         Integrity Report — ${this.label.padEnd(28)}║${COLOR.reset}`);
    lines.push(`${COLOR.bold}╚══════════════════════════════════════════════════════════╝${COLOR.reset}`);
    lines.push('');

    const status = this.pass() ? `${COLOR.green}PASS${COLOR.reset}` : `${COLOR.red}FAIL${COLOR.reset}`;

    // Summary
    lines.push(`  ${COLOR.cyan}Summary${COLOR.reset}`);
    lines.push(`    Total items: ${this.results.summary.total_items}`);
    const catParts = [];
    for (const [cat, count] of Object.entries(this.results.summary.categories)) {
      if (count > 0) catParts.push(`${cat}=${count}`);
    }
    if (catParts.length > 0) lines.push(`    ${catParts.join('  ')}`);

    // Schema
    lines.push(`\n  ${COLOR.cyan}Schema${COLOR.reset}`);
    const schemaErrors = this.results.schema.errors.length;
    const sMark = schemaErrors === 0 ? `${COLOR.green}✓${COLOR.reset}` : `${COLOR.red}✗${COLOR.reset}`;
    lines.push(`    ${sMark} Checked ${this.results.schema.checked} required fields, ${schemaErrors} error(s)`);
    for (const e of this.results.schema.errors.slice(0, 5)) {
      lines.push(`      ${COLOR.red}•${COLOR.reset} ${e}`);
    }

    // Integrity
    lines.push(`\n  ${COLOR.cyan}Integrity${COLOR.reset}`);
    const orphans = this.results.integrity.fk_orphans;
    const dupPKs = this.results.integrity.duplicate_pks;
    const iMark = orphans.length === 0 && dupPKs.length === 0 ? `${COLOR.green}✓${COLOR.reset}` : `${COLOR.red}✗${COLOR.reset}`;
    lines.push(`    ${iMark} FK orphans       ${orphans.length}`);
    lines.push(`       Duplicate PKs   ${dupPKs.length}`);
    for (const o of orphans.slice(0, 5)) {
      lines.push(`      ${COLOR.red}•${COLOR.reset} ${o.category}:${o.id} → ${o.key}=${o.value} missing in ${o.parentCategory}`);
    }
    for (const d of dupPKs.slice(0, 5)) {
      lines.push(`      ${COLOR.red}•${COLOR.reset} ${d.category}:${d.id}`);
    }

    // Conflicts
    lines.push(`\n  ${COLOR.cyan}Conflicts${COLOR.reset}`);
    const conflicts = this.results.conflicts.already_exists;
    const cMark = conflicts.length === 0 ? `${COLOR.green}✓${COLOR.reset}` : `${COLOR.yellow}⚠${COLOR.reset}`;
    lines.push(`    ${cMark} Already in local DB  ${conflicts.length}`);
    for (const c of conflicts.slice(0, 5)) {
      lines.push(`      ${COLOR.yellow}•${COLOR.reset} ${c.category}:${c.id}`);
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

module.exports = IntegrityReport;
