export interface Migration {
  version: number;
  up: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    up: [
      // TABLA DE USUARIOS - Centraliza datos de autenticación
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        token TEXT NOT NULL,
        refresh_token TEXT,
        profile_image_url TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        code TEXT,
        name TEXT NOT NULL,
        credits REAL,
        professor TEXT,
        color TEXT,
        icon TEXT,
        target_grade REAL,
        avg_score REAL,
        normalized_avg_score REAL,
        completion_percent REAL,
        display_label TEXT,
        display_color TEXT,
        gpa_equivalent REAL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        date TEXT,
        weight REAL,
        out_of REAL,
        score REAL,
        percentage REAL,
        grade_value REAL,
        normalized_value REAL,
        is_completed INTEGER DEFAULT 0,
        display_label TEXT,
        display_color TEXT,
        gpa_equivalent REAL,
        category_id TEXT,
        due_date TEXT,
        grading_date TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS assessment_categories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT,
        name TEXT NOT NULL,
        weight REAL,
        drop_lowest INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT,
        day_of_week INTEGER,
        start_time TEXT,
        end_time TEXT,
        name TEXT,
        color TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS flashcard_decks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        card_count INTEGER DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        learning_count INTEGER DEFAULT 0,
        new_count INTEGER DEFAULT 0,
        subject_name TEXT,
        subject_color TEXT,
        subject_icon TEXT,
        owner_username TEXT,
        owner_name TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS flashcards (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        front TEXT NOT NULL,
        back TEXT,
        status TEXT DEFAULT 'new',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS card_logs (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        result TEXT,
        response_time_ms INTEGER,
        question_word_count INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS study_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT,
        deck_id TEXT,
        duration_minutes INTEGER,
        cards_reviewed INTEGER,
        rating TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        local_uri TEXT,
        created_at TEXT,
        es_favorita INTEGER DEFAULT 0,
        ocr_text TEXT,
        tags TEXT,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        group_id TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS audio_recordings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT,
        name TEXT,
        local_uri TEXT,
        duration REAL,
        created_at TEXT,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        id_string TEXT,
        uri TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS youtube_videos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT,
        youtube_url TEXT,
        video_id TEXT,
        title TEXT,
        thumbnail_url TEXT,
        duration TEXT,
        created_at TEXT,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS scanned_documents (
        id TEXT PRIMARY KEY,
        subject_id TEXT,
        user_id TEXT NOT NULL,
        local_uri TEXT,
        ocr_text TEXT,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        event_type TEXT,
        start_date TEXT,
        end_date TEXT,
        all_day INTEGER DEFAULT 0,
        subject_id TEXT,
        study_plan_flag INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        operation TEXT NOT NULL CHECK(operation IN ('CREATE','UPDATE','DELETE')),
        payload TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
        retries INTEGER DEFAULT 0,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_assessments_subject ON assessments(subject_id)`,
      `CREATE INDEX IF NOT EXISTS idx_schedules_subject ON schedules(subject_id)`,
      `CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id)`,
      `CREATE INDEX IF NOT EXISTS idx_photos_subject ON photos(subject_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audio_subject ON audio_recordings(subject_id)`,
      `CREATE INDEX IF NOT EXISTS idx_youtube_subject ON youtube_videos(subject_id)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_subject ON scanned_documents(subject_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,
    ],
  },
  {
    version: 2,
    up: [
      `ALTER TABLE youtube_videos ADD COLUMN is_backed_up INTEGER DEFAULT 0`,
      `ALTER TABLE youtube_videos ADD COLUMN cloud_url TEXT`,
    ],
  },
  {
    version: 3,
    up: [
      `CREATE TABLE IF NOT EXISTS assessment_files (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        local_uri TEXT,
        cloud_url TEXT,
        file_size INTEGER,
        is_backed_up INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_assessment_files_assessment ON assessment_files(assessment_id)`,
    ],
  },
  {
    version: 4,
    up: [
      `ALTER TABLE audio_recordings ADD COLUMN summary_text TEXT`,
      `ALTER TABLE youtube_videos ADD COLUMN summary_text TEXT`,
    ],
  },
  {
    version: 5,
    up: [
      `CREATE TABLE IF NOT EXISTS grade_history (
        id TEXT PRIMARY KEY,
        assessment_result_id TEXT NOT NULL,
        old_raw_value REAL,
        new_raw_value REAL NOT NULL,
        changed_by TEXT,
        changed_at TEXT DEFAULT (datetime('now')),
        reason TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_grade_history_result ON grade_history(assessment_result_id)`,
    ],
  },
  {
    version: 6,
    up: [
      `CREATE TABLE IF NOT EXISTS assessment_files (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        local_uri TEXT,
        cloud_url TEXT,
        file_size INTEGER,
        is_backed_up INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_assessment_files_assessment ON assessment_files(assessment_id)`,
    ],
  },
  {
    version: 7,
    up: [
      `CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        platform TEXT,
        certificate_url TEXT,
        momentum_score REAL DEFAULT 1.0,
        last_studied_at TEXT,
        is_backed_up INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TRIGGER IF NOT EXISTS update_courses_timestamp
      AFTER UPDATE ON courses
      FOR EACH ROW
      BEGIN
          UPDATE courses SET updated_at = datetime('now') WHERE id = OLD.id;
      END;`,
      `ALTER TABLE subjects ADD COLUMN course_id TEXT REFERENCES courses(id) ON DELETE SET NULL`,
      `ALTER TABLE subjects ADD COLUMN external_url TEXT`,
      `ALTER TABLE subjects ADD COLUMN total_lessons INTEGER DEFAULT 0`,
      `ALTER TABLE subjects ADD COLUMN completed_lessons INTEGER DEFAULT 0`,
      `ALTER TABLE subjects ADD COLUMN next_micro_milestone TEXT`
    ],
  },
];

export default migrations;
