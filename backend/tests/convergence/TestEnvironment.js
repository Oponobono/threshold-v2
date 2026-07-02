const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const DeviceSimulator = require('./DeviceSimulator');

class TestEnvironment {
  constructor() {
    this.backendDbPath = path.join(os.tmpdir(), `convergence_backend_${Date.now()}.db`);
    this.backendUrl = null;
    this.server = null;
    this.userId = null;
    this.jwtToken = null;
    this.syncVersionRowCreated = false;
  }

  async start() {
    const db = new sqlite3.Database(this.backendDbPath);
    // Force JWT_SECRET before dotenv loads the .env production key
    process.env.JWT_SECRET = 'test-secret-key-threshold';
    await new Promise((resolve, reject) => {
      let pending = 0;
      const done = () => { if (--pending <= 0) resolve(); };
      const run = (sql, params) => {
        pending++;
        if (params) db.run(sql, params, done);
        else db.run(sql, done);
      };
      run(`PRAGMA foreign_keys = ON`);
      run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT NOT NULL,
        name TEXT, username TEXT UNIQUE, share_pin VARCHAR(8) UNIQUE,
        status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT DEFAULT (datetime('now'))
      )`);
      run(`CREATE TABLE IF NOT EXISTS sync_version (
        id INTEGER PRIMARY KEY, version INTEGER DEFAULT 0, updated_at TEXT
      )`);
      run(`INSERT OR IGNORE INTO sync_version (id, version, updated_at) VALUES (1, 0, datetime('now'))`);
      run(`CREATE TABLE IF NOT EXISTS sync_deletions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        user_id TEXT NOT NULL, deleted_at TEXT DEFAULT (datetime('now')),
        deletion_version INTEGER,
        UNIQUE(entity_type, entity_id, user_id)
      )`);
      for (const sql of Object.values(TABLE_SCHEMAS)) run(sql);
    });
    // Verify sync_version row exists
    const svRow = await new Promise((resolve) => {
      db.get('SELECT version FROM sync_version WHERE id = 1', [], (err, row) => {
        if (err) console.error('[TestEnv] sync_version check error:', err.message);
        resolve(row ? row.version : null);
      });
    });
    if (svRow === null) {
      // Retry insert directly
      await new Promise((resolve) => {
        db.run('INSERT OR IGNORE INTO sync_version (id, version, updated_at) VALUES (1, 0, datetime(\'now\'))', [], () => resolve());
      });
      const check = await new Promise((resolve) => {
        db.get('SELECT version FROM sync_version WHERE id = 1', [], (err, row) => {
          resolve(row ? row.version : -1);
        });
      });
      if (check === -1) {
        console.error('[TestEnv] FATAL: sync_version row could not be created');
      }
    }

    this.backendDb = db;

    const userId = uuidv4();
    const sharePin = 'TESTPIN';
    const hash = await bcrypt.hash('test-password', 4);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, email, password_hash, name, username, share_pin) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, `test_${Date.now()}@test.com`, hash, 'Test User', `testuser_${Date.now()}`, sharePin],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });

    this.userId = userId;
    this.jwtToken = jwt.sign(
      { id: userId, email: `test_${Date.now()}@test.com` },
      process.env.JWT_SECRET || 'test-secret-key-threshold',
      { expiresIn: '1h' }
    );

    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    const reqDb = {
      run: (sql, params, cb) => {
        if (typeof params === 'function') { cb = params; params = []; }
        db.run(sql, params, function (err) { if (cb) cb.call(this, err); });
      },
      get: (sql, params, cb) => {
        if (typeof params === 'function') { cb = params; params = []; }
        db.get(sql, params, (err, row) => { if (cb) cb(err, row); });
      },
      all: (sql, params, cb) => {
        if (typeof params === 'function') { cb = params; params = []; }
        db.all(sql, params, (err, rows) => { if (cb) cb(err, rows); });
      },
    };

    const authMw = (req, res, next) => {
      const auth = req.headers['authorization'];
      if (!auth) return res.status(401).json({ error: 'No token' });
      try {
        const decoded = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET || 'test-secret-key-threshold');
        req.user = { id: decoded.id, email: decoded.email };
        next();
      } catch { res.status(401).json({ error: 'Invalid token' }); }
    };

    // Override db module for controllers
    const originalDb = require('../../db');
    originalDb.db = reqDb;
    originalDb.initializeDb = async () => {};

    const subjectsController = require('../../controllers/subjectsController');
    const coursesController = require('../../controllers/coursesController');
    const flashcardsController = require('../../controllers/flashcardsController');
    const syncController = require('../../controllers/syncController');
    const galleryController = require('../../controllers/galleryController');
    const audioController = require('../../controllers/audioController');
    const scannedDocumentsController = require('../../controllers/scannedDocumentsController');

    // Subjects routes
    app.post('/api/subjects', authMw, subjectsController.createSubject);
    app.put('/api/subjects/:subjectId', authMw, subjectsController.updateSubject);
    app.delete('/api/subjects/:subjectId', authMw, subjectsController.deleteSubject);

    // Courses routes
    app.post('/api/courses', authMw, coursesController.createCourse);
    app.put('/api/courses/:courseId', authMw, coursesController.updateCourse);
    app.delete('/api/courses/:courseId', authMw, coursesController.deleteCourse);

    // Flashcard routes
    app.post('/api/flashcard-decks', authMw, flashcardsController.createFlashcardDeck);
    app.put('/api/flashcard-decks/:deckId', authMw, flashcardsController.updateFlashcardDeck);
    app.delete('/api/flashcard-decks/:deckId', authMw, flashcardsController.deleteDeck);
    app.post('/api/flashcard-decks/:deckId/cards', authMw, flashcardsController.createCard);
    app.put('/api/flashcards/:cardId', authMw, flashcardsController.updateCardStatus);

    // Photo routes
    app.post('/api/photos', authMw, galleryController.savePhoto);
    app.put('/api/photos/:photoId', authMw, galleryController.updatePhoto);
    app.delete('/api/photos/:photoId', authMw, galleryController.deletePhoto);

    // Audio recording routes
    app.post('/api/audio-recordings', authMw, audioController.createAudioRecording);
    app.put('/api/audio-recordings/:id', authMw, audioController.updateAudioRecording);
    app.delete('/api/audio-recordings/:id', authMw, audioController.deleteAudioRecording);
    app.post('/api/audio-transcripts', authMw, audioController.upsertAudioTranscript);

    // Scanned document routes
    app.post('/api/scanned_documents', authMw, scannedDocumentsController.saveScannedDocument);
    app.put('/api/scanned_documents/:documentId', authMw, scannedDocumentsController.updateScannedDocument);
    app.delete('/api/scanned_documents/:documentId', authMw, scannedDocumentsController.deleteScannedDocument);

    // Sync routes
    app.get('/api/sync/initial', authMw, syncController.initialSync);
    app.get('/api/sync/delta', authMw, syncController.deltaSync);

    // Health
    app.get('/health', (req, res) => res.sendStatus(200));

    const port = await new Promise((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => {
        resolve(srv.address().port);
      });
      this.server = srv;
    });

    this.backendUrl = `http://127.0.0.1:${port}`;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-threshold';
    return this;
  }

  async createDevice(name) {
    return new DeviceSimulator(name, this.backendUrl, this.userId, this.jwtToken);
  }

  async restart() {
    // Close the old server
    await new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });

    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    const db = this.backendDb;

    const reqDb = {
      run: (sql, params, cb) => {
        if (typeof params === 'function') { cb = params; params = []; }
        db.run(sql, params, function (err) { if (cb) cb.call(this, err); });
      },
      get: (sql, params, cb) => {
        if (typeof params === 'function') { cb = params; params = []; }
        db.get(sql, params, (err, row) => { if (cb) cb(err, row); });
      },
      all: (sql, params, cb) => {
        if (typeof params === 'function') { cb = params; params = []; }
        db.all(sql, params, (err, rows) => { if (cb) cb(err, rows); });
      },
    };

    const authMw = (req, res, next) => {
      const auth = req.headers['authorization'];
      if (!auth) return res.status(401).json({ error: 'No token' });
      try {
        const decoded = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET || 'test-secret-key-threshold');
        req.user = { id: decoded.id, email: decoded.email };
        next();
      } catch { res.status(401).json({ error: 'Invalid token' }); }
    };

    const originalDb = require('../../db');
    originalDb.db = reqDb;
    originalDb.initializeDb = async () => {};

    const subjectsController = require('../../controllers/subjectsController');
    const coursesController = require('../../controllers/coursesController');
    const flashcardsController = require('../../controllers/flashcardsController');
    const syncController = require('../../controllers/syncController');
    const galleryController = require('../../controllers/galleryController');
    const audioController = require('../../controllers/audioController');
    const scannedDocumentsController = require('../../controllers/scannedDocumentsController');

    app.post('/api/subjects', authMw, subjectsController.createSubject);
    app.put('/api/subjects/:subjectId', authMw, subjectsController.updateSubject);
    app.delete('/api/subjects/:subjectId', authMw, subjectsController.deleteSubject);
    app.post('/api/courses', authMw, coursesController.createCourse);
    app.put('/api/courses/:courseId', authMw, coursesController.updateCourse);
    app.delete('/api/courses/:courseId', authMw, coursesController.deleteCourse);
    app.post('/api/flashcard-decks', authMw, flashcardsController.createFlashcardDeck);
    app.put('/api/flashcard-decks/:deckId', authMw, flashcardsController.updateFlashcardDeck);
    app.delete('/api/flashcard-decks/:deckId', authMw, flashcardsController.deleteDeck);
    app.post('/api/flashcard-decks/:deckId/cards', authMw, flashcardsController.createCard);
    app.put('/api/flashcards/:cardId', authMw, flashcardsController.updateCardStatus);
    app.post('/api/photos', authMw, galleryController.savePhoto);
    app.put('/api/photos/:photoId', authMw, galleryController.updatePhoto);
    app.delete('/api/photos/:photoId', authMw, galleryController.deletePhoto);
    app.post('/api/audio-recordings', authMw, audioController.createAudioRecording);
    app.put('/api/audio-recordings/:id', authMw, audioController.updateAudioRecording);
    app.delete('/api/audio-recordings/:id', authMw, audioController.deleteAudioRecording);
    app.post('/api/audio-transcripts', authMw, audioController.upsertAudioTranscript);
    app.post('/api/scanned_documents', authMw, scannedDocumentsController.saveScannedDocument);
    app.put('/api/scanned_documents/:documentId', authMw, scannedDocumentsController.updateScannedDocument);
    app.delete('/api/scanned_documents/:documentId', authMw, scannedDocumentsController.deleteScannedDocument);
    app.get('/api/sync/initial', authMw, syncController.initialSync);
    app.get('/api/sync/delta', authMw, syncController.deltaSync);
    app.get('/health', (req, res) => res.sendStatus(200));

    const port = await new Promise((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => {
        resolve(srv.address().port);
      });
      this.server = srv;
    });

    const oldUrl = this.backendUrl;
    this.backendUrl = `http://127.0.0.1:${port}`;
    console.log(`[TestEnv] Server restarted: ${oldUrl} -> ${this.backendUrl}`);
    return this.backendUrl;
  }

  async queryBackend(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.backendDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async dumpBackend() {
    const tables = [
      'subjects', 'courses', 'flashcard_decks', 'flashcards',
      'assessments', 'schedules', 'calendar_events',
      'grading_periods', 'lms_accounts', 'subject_threshold_overrides',
      'photos', 'audio_recordings', 'audio_transcripts', 'scanned_documents',
      'youtube_videos', 'youtube_transcripts',
      'sync_deletions', 'sync_version',
    ];
    const result = {};
    for (const t of tables) {
      try {
        result[t] = await this.queryBackend(`SELECT * FROM ${t} ORDER BY id`);
      } catch { result[t] = []; }
    }
    return result;
  }

  async stop() {
    try { this.server.close(); } catch {}
    try { this.backendDb.close(); } catch {}
    try { fs.unlinkSync(this.backendDbPath); } catch {}
  }
}

const TABLE_SCHEMAS = {
  subjects: `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY, user_id TEXT, code TEXT, name TEXT,
    credits REAL, professor TEXT, color TEXT, icon TEXT,
    target_grade TEXT, course_id TEXT, external_url TEXT,
    total_lessons INTEGER DEFAULT 0, completed_lessons INTEGER DEFAULT 0,
    next_micro_milestone TEXT, created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  courses: `CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY, user_id TEXT, name TEXT, platform TEXT,
    certificate_url TEXT, main_url TEXT, deep_link_url TEXT,
    instructor TEXT, total_hours REAL, total_classes INTEGER DEFAULT 0,
    completed_classes INTEGER DEFAULT 0, status TEXT,
    global_notes TEXT, tags TEXT, momentum_score REAL DEFAULT 1.0,
    last_studied_at TEXT, created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  flashcard_decks: `CREATE TABLE IF NOT EXISTS flashcard_decks (
    id TEXT PRIMARY KEY, subject_id TEXT, user_id TEXT, title TEXT,
    description TEXT, linked_event_id TEXT, card_count INTEGER DEFAULT 0,
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  flashcards: `CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY, deck_id TEXT, user_id TEXT, front TEXT, back TEXT,
    item_type TEXT DEFAULT 'flashcard', content_json TEXT,
    hint TEXT, explanation TEXT, status TEXT DEFAULT 'new',
    next_review_date TEXT, sm2_ease_factor REAL DEFAULT 2.5,
    sm2_interval INTEGER DEFAULT 1, sm2_repetitions INTEGER DEFAULT 0,
    fsrs_stability REAL DEFAULT 1, fsrs_difficulty REAL DEFAULT 0.5,
    fsrs_repetitions INTEGER DEFAULT 0,
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0, last_modified_by TEXT,
    FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
  )`,
  assessments: `CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, category_id TEXT,
    name TEXT, description TEXT, max_score REAL, weight REAL,
    score REAL, normalized_value REAL, is_completed INTEGER DEFAULT 0,
    completed_at TEXT, due_date TEXT, created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  assessment_categories: `CREATE TABLE IF NOT EXISTS assessment_categories (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, name TEXT,
    weight REAL, created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  schedules: `CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, title TEXT,
    description TEXT, day_of_week INTEGER, start_time TEXT, end_time TEXT,
    location TEXT, color TEXT, is_active INTEGER DEFAULT 1,
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  calendar_events: `CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY, user_id TEXT, title TEXT, description TEXT,
    start_date TEXT, end_date TEXT, all_day INTEGER DEFAULT 0,
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  grading_periods: `CREATE TABLE IF NOT EXISTS grading_periods (
    id TEXT PRIMARY KEY, user_id TEXT, name TEXT,
    period_type TEXT DEFAULT 'custom', start_date TEXT, end_date TEXT,
    is_active INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  lms_accounts: `CREATE TABLE IF NOT EXISTS lms_accounts (
    id TEXT PRIMARY KEY, user_id TEXT, platform TEXT, instance_url TEXT,
    username TEXT, created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  subject_threshold_overrides: `CREATE TABLE IF NOT EXISTS subject_threshold_overrides (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT,
    threshold REAL DEFAULT 70, created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT
  )`,
  study_sessions: `CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, deck_id TEXT,
    duration_minutes INTEGER, cards_reviewed INTEGER, rating TEXT,
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
  )`,
  shared_decks: `CREATE TABLE IF NOT EXISTS shared_decks (
    id TEXT PRIMARY KEY, deck_id TEXT NOT NULL,
    shared_by_user_id TEXT NOT NULL, shared_to_user_id TEXT NOT NULL,
    shared_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    UNIQUE(deck_id, shared_to_user_id)
  )`,
  photos: `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT,
    name TEXT, local_uri TEXT,
    es_favorita INTEGER DEFAULT 0, ocr_text TEXT, tags TEXT, group_id TEXT,
    cloud_url TEXT, is_backed_up INTEGER DEFAULT 0,
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT,
    version_number INTEGER DEFAULT 0
  )`,
  audio_recordings: `CREATE TABLE IF NOT EXISTS audio_recordings (
    id TEXT PRIMARY KEY, user_id TEXT, subject_id TEXT, name TEXT,
    local_uri TEXT, duration REAL, created_at TEXT, cloud_url TEXT,
    is_backed_up INTEGER DEFAULT 0, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
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
    created_at TEXT, updated_at TEXT,
    sync_version INTEGER DEFAULT 0, deleted_at TEXT, version_number INTEGER DEFAULT 0
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  youtube_transcripts: `CREATE TABLE IF NOT EXISTS youtube_transcripts (
    id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL UNIQUE,
    user_id TEXT,
    transcript_uri TEXT,
    transcript_text TEXT,
    summary_uri TEXT,
    summary_text TEXT,
    cloud_url TEXT,
    is_backed_up INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_version INTEGER DEFAULT 0, version_number INTEGER DEFAULT 0, deleted_at TEXT,
    FOREIGN KEY (video_id) REFERENCES youtube_videos(id) ON DELETE CASCADE
  )`,
};

module.exports = TestEnvironment;
