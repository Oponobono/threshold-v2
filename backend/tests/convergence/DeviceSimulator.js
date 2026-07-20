const path = require('path');
const os = require('os');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const SYNCABLE_TABLES = [
  'subjects', 'courses', 'flashcard_decks', 'flashcards',
  'assessments', 'assessment_categories', 'assessment_files',
  'schedules', 'calendar_events', 'grading_periods', 'lms_accounts',
  'subject_threshold_overrides', 'study_sessions', 'study_notes',
  'photos', 'audio_recordings', 'audio_transcripts', 'scanned_documents',
  'youtube_videos', 'youtube_transcripts', 'ai_chats', 'document_highlights',
];

const TABLE_DEFS = {
  users: `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT, name TEXT, username TEXT,
    password_hash TEXT, share_pin VARCHAR(8), status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT DEFAULT (datetime('now'))
  )`,
  subjects: `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY, user_id TEXT, code TEXT, name TEXT,
    credits REAL, professor TEXT, color TEXT, icon TEXT,
    target_grade TEXT, course_id TEXT, external_url TEXT,
    total_lessons INTEGER DEFAULT 0, completed_lessons INTEGER DEFAULT 0,
    next_micro_milestone TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version_number INTEGER DEFAULT 0, sync_version INTEGER DEFAULT 0,
    deleted_at TEXT, last_modified_by TEXT
  )`,
  courses: `CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY, user_id TEXT, name TEXT, platform TEXT,
    certificate_url TEXT, main_url TEXT, deep_link_url TEXT,
    instructor TEXT, total_hours REAL, total_classes INTEGER,
    completed_classes INTEGER, status TEXT, global_notes TEXT,
    tags TEXT, momentum_score REAL DEFAULT 1.0, last_studied_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version_number INTEGER DEFAULT 0, sync_version INTEGER DEFAULT 0,
    deleted_at TEXT, last_modified_by TEXT
  )`,
  flashcard_decks: `CREATE TABLE IF NOT EXISTS flashcard_decks (
    id TEXT PRIMARY KEY, subject_id TEXT, user_id TEXT, title TEXT,
    description TEXT, linked_event_id TEXT, card_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version_number INTEGER DEFAULT 0, sync_version INTEGER DEFAULT 0,
    deleted_at TEXT, last_modified_by TEXT
  )`,
  flashcards: `CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY, deck_id TEXT, user_id TEXT, front TEXT, back TEXT,
    item_type TEXT DEFAULT 'flashcard', content_json TEXT,
    hint TEXT, explanation TEXT, status TEXT DEFAULT 'new',
    next_review_date TEXT, sm2_ease_factor REAL DEFAULT 2.5,
    sm2_interval INTEGER DEFAULT 1, sm2_repetitions INTEGER DEFAULT 0,
    fsrs_stability REAL DEFAULT 1, fsrs_difficulty REAL DEFAULT 0.5,
    fsrs_repetitions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    version_number INTEGER DEFAULT 0, sync_version INTEGER DEFAULT 0,
    deleted_at TEXT, last_modified_by TEXT,
    FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
  )`,
  photos: `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, name TEXT,
    local_uri TEXT, tags TEXT, es_favorita INTEGER DEFAULT 0,
    ocr_text TEXT, group_id TEXT,
    cloud_url TEXT, is_backed_up INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT,
    version_number INTEGER DEFAULT 0
  )`,
  audio_recordings: `CREATE TABLE IF NOT EXISTS audio_recordings (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, name TEXT,
    local_uri TEXT, duration REAL, cloud_url TEXT,
    is_backed_up INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT,
    version_number INTEGER DEFAULT 0
  )`,
  youtube_videos: `CREATE TABLE IF NOT EXISTS youtube_videos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject_id TEXT,
    youtube_url TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT,
    thumbnail_url TEXT,
    duration INTEGER,
    sync_version INTEGER DEFAULT 0,
    deleted_at TEXT,
    version_number INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  youtube_transcripts: `CREATE TABLE IF NOT EXISTS youtube_transcripts (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL UNIQUE,
    transcript_uri TEXT,
    transcript_text TEXT,
    summary_uri TEXT,
    summary_text TEXT,
    cloud_url TEXT,
    is_backed_up INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES youtube_videos(id) ON DELETE CASCADE
  )`,
  audio_transcripts: `CREATE TABLE IF NOT EXISTS audio_transcripts (
    id TEXT PRIMARY KEY,
    recording_id TEXT NOT NULL,
    user_id TEXT,
    transcript_uri TEXT,
    transcript_text TEXT,
    summary_uri TEXT,
    summary_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cloud_url TEXT,
    is_backed_up INTEGER DEFAULT 0,
    sync_version INTEGER DEFAULT 0,
    deleted_at TEXT,
    version_number INTEGER DEFAULT 0,
    FOREIGN KEY (recording_id) REFERENCES audio_recordings(id) ON DELETE CASCADE
  )`,
  scanned_documents: `CREATE TABLE IF NOT EXISTS scanned_documents (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, name TEXT,
    file_path TEXT, local_uri TEXT, ocr_text TEXT,
    cloud_url TEXT, is_backed_up INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT,
    version_number INTEGER DEFAULT 0
  )`,
  ai_chats: `CREATE TABLE IF NOT EXISTS ai_chats (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT,
    role TEXT, content TEXT, cloud_url TEXT, is_backed_up INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  assessments: `CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, category_id TEXT,
    name TEXT, type TEXT, description TEXT, date TEXT, max_score REAL, weight REAL,
    out_of REAL, score REAL, percentage REAL, grade_value REAL,
    normalized_value REAL, is_completed INTEGER DEFAULT 0,
    completed_at TEXT, due_date TEXT, period_id TEXT, grading_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  schedules: `CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, title TEXT,
    description TEXT, day_of_week INTEGER, start_time TEXT, end_time TEXT,
    location TEXT, color TEXT, is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  calendar_events: `CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY, user_id TEXT, title TEXT, description TEXT,
    start_date TEXT, end_date TEXT, all_day INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  grading_periods: `CREATE TABLE IF NOT EXISTS grading_periods (
    id TEXT PRIMARY KEY, user_id TEXT, name TEXT,
    period_type TEXT DEFAULT 'custom', start_date TEXT, end_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  lms_accounts: `CREATE TABLE IF NOT EXISTS lms_accounts (
    id TEXT PRIMARY KEY, user_id TEXT, platform TEXT, instance_url TEXT,
    username TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  subject_threshold_overrides: `CREATE TABLE IF NOT EXISTS subject_threshold_overrides (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT,
    threshold REAL DEFAULT 70,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  study_sessions: `CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, deck_id TEXT,
    duration_minutes INTEGER, cards_reviewed INTEGER, rating TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  assessment_categories: `CREATE TABLE IF NOT EXISTS assessment_categories (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, name TEXT, weight REAL,
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  assessment_files: `CREATE TABLE IF NOT EXISTS assessment_files (
    id TEXT PRIMARY KEY, assessment_id TEXT, user_id TEXT,
    file_name TEXT, file_type TEXT, local_uri TEXT, cloud_url TEXT,
    is_backed_up INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
  )`,
  study_notes: `CREATE TABLE IF NOT EXISTS study_notes (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT,
    title TEXT, content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  document_highlights: `CREATE TABLE IF NOT EXISTS document_highlights (
    id TEXT PRIMARY KEY, document_id TEXT, user_id TEXT,
    page INTEGER, text TEXT, color TEXT, note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0,
    FOREIGN KEY (document_id) REFERENCES scanned_documents(id) ON DELETE CASCADE
  )`,
};

const QUEUE_SCHEMA = `CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  operation TEXT NOT NULL CHECK(operation IN ('CREATE','UPDATE','DELETE')),
  payload TEXT,
  status TEXT DEFAULT 'pending',
  retries INTEGER DEFAULT 0,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`;

const ENTITY_MAP = {
  subject: { table: 'subjects', path: '/subjects' },
  course: { table: 'courses', path: '/courses' },
  'flashcard-deck': { table: 'flashcard_decks', path: '/flashcard-decks' },
  flashcard: { table: 'flashcards', path: '/flashcards' },
  assessment: { table: 'assessments', path: '/assessments' },
  'assessment-category': { table: 'assessment_categories', path: '/assessment-categories' },
  schedule: { table: 'schedules', path: '/schedules' },
  'calendar-event': { table: 'calendar_events', path: '/calendar/events' },
  photo: { table: 'photos', path: '/photos' },
  'audio-recording': { table: 'audio_recordings', path: '/audio-recordings' },
  'audio-transcript': { table: 'audio_transcripts', path: '/audio-transcripts' },
  'scanned-document': { table: 'scanned_documents', path: '/scanned_documents' },
  'study-note': { table: 'study_notes', path: '/study-notes' },
  'ai-chat': { table: 'ai_chats', path: '/ai-chats' },
};

class DeviceSimulator {
  constructor(name, backendUrl, userId, jwtToken) {
    this.name = name;
    this.backendUrl = backendUrl;
    this.userId = userId;
    this.jwtToken = jwtToken;
    this.lastSyncVersion = 0;
    this._latencyMs = 0;
    this._packetLossRate = 0;
    this.metrics = null;
    this.dbPath = path.join(os.tmpdir(), `convergence_${name}_${Date.now()}.db`);
    this.db = new sqlite3.Database(this.dbPath);
    this.db.serialize(() => {
      this.db.run('PRAGMA foreign_keys = ON');
      for (const sql of Object.values(TABLE_DEFS)) this.db.run(sql);
      this.db.run(QUEUE_SCHEMA);
    });
  }

  setMetrics(metricsInstance) {
    this.metrics = metricsInstance;
  }

  setNetworkConditions(latencyMs, packetLossRate) {
    this._latencyMs = latencyMs || 0;
    this._packetLossRate = packetLossRate || 0;
  }

  async _simulateNetwork() {
    if (this._latencyMs > 0) {
      const delay = Math.random() * this._latencyMs;
      await new Promise(r => setTimeout(r, delay));
    }
    if (this._packetLossRate > 0 && Math.random() < this._packetLossRate) {
      throw new Error(`Simulated packet loss on ${this.name}`);
    }
  }

  async getQueueDepth() {
    try {
      const row = await this._get(`SELECT COUNT(*) as cnt FROM sync_queue WHERE status = 'pending'`);
      return row?.cnt || 0;
    } catch { return 0; }
  }

  async getQueuePending() {
    return this._all(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC`);
  }

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async _upsertLocal(table, data) {
    const keys = Object.keys(data);
    const vals = keys.map(k => data[k]);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    await this._run(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${setClause}`,
      [...vals, ...vals]
    );
  }

  async _enqueue(entityType, entityId, operation, payload) {
    await this._run(
      `INSERT INTO sync_queue (entity_type, entity_id, operation, payload) VALUES (?, ?, ?, ?)`,
      [entityType, entityId, operation, payload ? JSON.stringify(payload) : null]
    );
  }

  _pathFor(entityType, entityId, operation, payload) {
    const map = ENTITY_MAP[entityType];
    if (!map) return null;
    if (entityType === 'flashcard' && operation === 'CREATE') {
      const deckId = payload?.deck_id || entityId;
      return `${this.backendUrl}/api/flashcard-decks/${deckId}/cards`;
    }
    if (operation === 'CREATE') return `${this.backendUrl}/api${map.path}`;
    return `${this.backendUrl}/api${map.path}/${entityId}`;
  }

  async _api(method, path, body) {
    try {
      const opts = {
        method,
        headers: { 'Authorization': `Bearer ${this.jwtToken}`, 'Content-Type': 'application/json' },
      };
      if (body && method !== 'GET') opts.body = JSON.stringify(body);
      const res = await fetch(`${this.backendUrl}${path}`, opts);
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body: json };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  async op(entityType, operation, entityId, data = {}) {
    const start = Date.now();
    const map = ENTITY_MAP[entityType];
    if (!map) throw new Error(`Unknown entity type: ${entityType}`);
    const fullData = { id: entityId, user_id: this.userId, ...data };
    if (operation === 'CREATE') {
      try { await this._upsertLocal(map.table, fullData); } catch (e) {
        // FK constraint (parent entity missing) — still enqueue, backend will validate
      }
    } else if (operation === 'UPDATE') {
      const existing = await this._get(`SELECT version_number FROM ${map.table} WHERE id = ?`, [entityId]);
      const ver = (existing?.version_number || 0) + 1;
      const keys = Object.keys(data);
      const vals = keys.map(k => data[k]);
      await this._run(
        `UPDATE ${map.table} SET ${keys.map(k => `${k} = ?`).join(', ')}, version_number = ?, updated_at = datetime('now') WHERE id = ?`,
        [...vals, ver, entityId]
      );
    } else if (operation === 'DELETE') {
      await this._run(`UPDATE ${map.table} SET deleted_at = datetime('now') WHERE id = ?`, [entityId]);
    }
    // Include id + user_id so backend uses clientId and validates ownership
    const payloadData = { id: entityId, user_id: this.userId, ...data };
    await this._enqueue(entityType, entityId, operation, operation !== 'DELETE' ? payloadData : undefined);
    const duration = Date.now() - start;
    if (this.metrics) {
      this.metrics.recordOp(operation, duration);
      const qd = await this.getQueueDepth();
      this.metrics.recordQueueDepth(qd);
    }
  }

  async sync() {
    const start = Date.now();
    await this._pushQueue();
    await this._pull();
    const duration = Date.now() - start;
    if (this.metrics) {
      this.metrics.recordSync(this.name, duration);
      const qd = await this.getQueueDepth();
      this.metrics.recordQueueDepth(qd);
    }
  }

  async syncPushOnly() {
    const start = Date.now();
    await this._pushQueue();
    const duration = Date.now() - start;
    if (this.metrics) {
      this.metrics.recordSync(this.name, duration);
      const qd = await this.getQueueDepth();
      this.metrics.recordQueueDepth(qd);
    }
  }

  async syncPullOnly() {
    const start = Date.now();
    await this._pull();
    const duration = Date.now() - start;
    if (this.metrics) {
      this.metrics.recordSync(this.name, duration);
      const qd = await this.getQueueDepth();
      this.metrics.recordQueueDepth(qd);
    }
  }

  async _pushQueue() {
    const items = await this._all(`SELECT * FROM sync_queue ORDER BY id ASC`);
    for (const item of items) {
      const payloadParsed = item.payload ? JSON.parse(item.payload) : {};
      const path = this._pathFor(item.entity_type, item.entity_id, item.operation, payloadParsed);
      if (!path) continue;
      if (this.metrics) this.metrics.recordRetries(item.retries || 0);
      console.log(`[${this.name}] push ${item.operation} ${item.entity_type}:${item.entity_id} -> ${path}`);
      const method = item.operation === 'CREATE' ? 'POST' : item.operation === 'UPDATE' ? 'PUT' : 'DELETE';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.jwtToken}`,
      };
      try {
        await this._simulateNetwork();
        const body = (item.operation !== 'DELETE' && item.payload) ? JSON.parse(item.payload) : {};
        if (body && typeof body === 'object') body.sync_version = this.lastSyncVersion;
        const opts = { method, headers };
        if (body && item.operation !== 'DELETE') opts.body = JSON.stringify(body);
        const resp = await fetch(path, opts);
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          console.log(`[${this.name}] push FAILED ${item.operation} ${item.entity_type}:${item.entity_id} [${resp.status}] ${errData.error||''}`);
          if (resp.status === 409 && this.metrics) {
            this.metrics.recordConflict();
          }
          if (errData.current_sync_version > this.lastSyncVersion) {
            this.lastSyncVersion = errData.current_sync_version;
          }
          if (resp.status === 404 || resp.status === 400) {
            // 404: Entity already gone or parent missing. Treat as resolved.
            // 400: Malformed request — permanent failure, remove to prevent infinite retry.
            await this._run(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
            continue;
          }
          await this._run(`UPDATE sync_queue SET retries = retries + 1, error = ? WHERE id = ?`,
            [errData.error || `HTTP ${resp.status}`, item.id]);
          continue;
        }
        const responseBody = (item.operation !== 'DELETE') ? await resp.json().catch(() => ({})) : {};
        if (responseBody.sync_version && responseBody.sync_version > this.lastSyncVersion) {
          console.log(`[${this.name}] sync_version advanced: ${this.lastSyncVersion} -> ${responseBody.sync_version}`);
          this.lastSyncVersion = responseBody.sync_version;
        }
        if (item.operation === 'CREATE' && responseBody.sync_version) {
          const entityMap = ENTITY_MAP[item.entity_type];
          if (entityMap && responseBody.id) {
            await this._run(`UPDATE ${entityMap.table} SET sync_version = ? WHERE id = ?`,
              [responseBody.sync_version, responseBody.id]);
          }
        }
        console.log(`[${this.name}] push OK ${item.operation} ${item.entity_type}:${item.entity_id}`);
        await this._run(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
      } catch (err) {
        if (err.message && err.message.includes('Simulated packet loss') && this.metrics) {
          this.metrics.recordDiscarded();
        }
        await this._run(`UPDATE sync_queue SET retries = retries + 1, error = ? WHERE id = ?`,
          [err.message, item.id]);
      }
    }
  }

  async _pull() {
    const isInitial = this.lastSyncVersion === 0;
    const endpoint = isInitial
      ? `${this.backendUrl}/api/sync/initial`
      : `${this.backendUrl}/api/sync/delta?version=${this.lastSyncVersion}`;
    console.log(`[${this.name}] pull ${isInitial ? 'initial' : 'delta'} (lastVersion=${this.lastSyncVersion})`);
    const headers = { 'Authorization': `Bearer ${this.jwtToken}` };
    try {
      const resp = await fetch(endpoint, { headers });
      if (!resp.ok) {
        console.log(`[${this.name}] pull FAILED HTTP ${resp.status}`);
        return;
      }
      const data = await resp.json();
      const serverVersion = data.syncVersion || 0;
      const payload = data.payload || data.updated || {};
      for (const [key, entities] of Object.entries(payload)) {
        try {
          if (!entities) continue;
          if (key === 'user') {
            const u = Array.isArray(entities) ? entities[0] : entities;
            if (u && u.id) await this._upsertLocal('users', u);
            continue;
          }
          if (key === 'flashcards') {
            for (const item of entities) {
              if (item.deck) {
                await this._upsertLocal('flashcard_decks', item.deck);
                if (item.cards) for (const c of item.cards) await this._upsertLocal('flashcards', c);
              } else if (item.id && item.deck_id) {
                await this._upsertLocal('flashcards', item);
              }
            }
            continue;
          }
          if (key === 'flashcardDecks') {
            for (const item of entities) {
              if (item && item.deck) {
                await this._upsertLocal('flashcard_decks', item.deck);
                if (item.cards) for (const c of item.cards) await this._upsertLocal('flashcards', c);
              } else if (item && item.id) {
                await this._upsertLocal('flashcard_decks', item);
              }
            }
            continue;
          }
          const table = {
            courses: 'courses', subjects: 'subjects', assessments: 'assessments',
            assessment_categories: 'assessment_categories',
            assessment_files: 'assessment_files',
            schedules: 'schedules',
            flashcards: 'flashcards',
            calendar_events: 'calendar_events', grading_periods: 'grading_periods',
            lms_accounts: 'lms_accounts',
            subject_threshold_overrides: 'subject_threshold_overrides',
            study_sessions: 'study_sessions',
            study_notes: 'study_notes',
            document_highlights: 'document_highlights',
            ai_chats: 'ai_chats',
            photos: 'photos',
            audio_recordings: 'audio_recordings', audio_transcripts: 'audio_transcripts',
            scanned_documents: 'scanned_documents',
            youtube_videos: 'youtube_videos', youtube_transcripts: 'youtube_transcripts',
          }[key];
          if (table && Array.isArray(entities)) {
            for (const e of entities) if (e && e.id) await this._upsertLocal(table, e);
          }
        } catch (e) {
          console.warn(`[${this.name}] pull entity ${key} error: ${e.message}`);
        }
      }
      const deletedCount = Array.isArray(data.deleted) ? data.deleted.length : 0;
      if (deletedCount > 0) console.log(`[${this.name}] pull got ${deletedCount} deletions`);
      if (Array.isArray(data.deleted)) {
        for (const d of data.deleted) {
          const t = {
            subjects: 'subjects', courses: 'courses', assessments: 'assessments',
            assessment_categories: 'assessment_categories',
            assessment_files: 'assessment_files',
            schedules: 'schedules', flashcard_decks: 'flashcard_decks', flashcards: 'flashcards',
            calendar_events: 'calendar_events', grading_periods: 'grading_periods',
            lms_accounts: 'lms_accounts',
            subject_threshold_overrides: 'subject_threshold_overrides',
            study_sessions: 'study_sessions',
            study_notes: 'study_notes',
            document_highlights: 'document_highlights',
            ai_chats: 'ai_chats',
            photos: 'photos',
            audio_recordings: 'audio_recordings', audio_transcripts: 'audio_transcripts',
            scanned_documents: 'scanned_documents',
            youtube_videos: 'youtube_videos', youtube_transcripts: 'youtube_transcripts',
          }[d.entityType];
          if (t) await this._run(`DELETE FROM ${t} WHERE id = ?`, [d.entityId]);
        }
      }
      if (serverVersion > this.lastSyncVersion) {
        console.log(`[${this.name}] pull completed: version ${this.lastSyncVersion} -> ${serverVersion}, entities=${Object.values(payload).reduce((s,a) => s + (Array.isArray(a)?a.length:0), 0)}`);
        this.lastSyncVersion = serverVersion;
      }
    } catch (err) {
      console.warn(`[${this.name}] pull error:`, err.message);
    }
  }

  async dumpAll() {
    const result = {};
    for (const table of SYNCABLE_TABLES) {
      try {
        result[table] = await this._all(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY id`);
      } catch { result[table] = []; }
    }
    result.sync_queue = await this._all(`SELECT * FROM sync_queue`);
    result.lastSyncVersion = this.lastSyncVersion;
    return result;
  }

  async destroy() {
    try { this.db.close(); fs.unlinkSync(this.dbPath); } catch {}
  }

  async markAsBackedUp(type, id, cloudUrl, extra = {}) {
    const body = { type, id, cloud_url: cloudUrl, ...extra };
    try {
      const res = await fetch(`${this.backendUrl}/api/backup/mark`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.jwtToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  async getBackupStats() {
    try {
      const res = await fetch(`${this.backendUrl}/api/backup/stats`, {
        headers: { 'Authorization': `Bearer ${this.jwtToken}` },
      });
      return await res.json();
    } catch { return null; }
  }

  async getPendingItems() {
    try {
      const res = await fetch(`${this.backendUrl}/api/backup/pending`, {
        headers: { 'Authorization': `Bearer ${this.jwtToken}` },
      });
      return await res.json();
    } catch { return null; }
  }

  async getCloudItems() {
    try {
      const res = await fetch(`${this.backendUrl}/api/backup/cloud-items`, {
        headers: { 'Authorization': `Bearer ${this.jwtToken}` },
      });
      return await res.json();
    } catch { return null; }
  }

  async restoreLocalUri(type, id, localUri) {
    const body = { type, id, local_uri: localUri };
    try {
      const res = await fetch(`${this.backendUrl}/api/backup/restore-local-uri`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.jwtToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
    } catch (err) { return { ok: false, error: err.message }; }
  }

  async wipeLocalData() {
    for (const table of SYNCABLE_TABLES) {
      try { await this._run(`DELETE FROM ${table}`); } catch {}
    }
    try { await this._run(`DELETE FROM sync_queue`); } catch {}
    this.lastSyncVersion = 0;
  }
}

module.exports = DeviceSimulator;
