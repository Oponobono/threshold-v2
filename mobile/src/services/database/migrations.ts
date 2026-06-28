export interface Migration {
  version: number;
  up: string[];
}

export const EXAM_COMPRESSION_WINDOW_DAYS = 30;

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
  {
    version: 8,
    up: [
      `ALTER TABLE flashcards ADD COLUMN direction TEXT NOT NULL DEFAULT 'forward'`
    ],
  },
  {
    version: 9,
    up: [
      `ALTER TABLE flashcards ADD COLUMN source_context TEXT`
    ],
  },
  {
    version: 10,
    up: [
      `ALTER TABLE courses ADD COLUMN main_url TEXT`,
      `ALTER TABLE courses ADD COLUMN deep_link_url TEXT`,
      `ALTER TABLE courses ADD COLUMN instructor TEXT`,
      `ALTER TABLE courses ADD COLUMN total_hours INTEGER DEFAULT 0`,
      `ALTER TABLE courses ADD COLUMN status TEXT DEFAULT 'active'`,
      `ALTER TABLE courses ADD COLUMN global_notes TEXT`,
      `ALTER TABLE courses ADD COLUMN tags TEXT`,
    ],
  },
  {
    version: 11,
    up: [
      `ALTER TABLE courses ADD COLUMN total_classes INTEGER DEFAULT 0`,
      `ALTER TABLE courses ADD COLUMN completed_classes INTEGER DEFAULT 0`,
      `UPDATE courses SET total_classes = COALESCE((SELECT SUM(total_lessons) FROM subjects WHERE course_id = courses.id), 0), completed_classes = COALESCE((SELECT SUM(completed_lessons) FROM subjects WHERE course_id = courses.id), 0)`,
    ],
  },
  {
    version: 12,
    up: [
      `ALTER TABLE calendar_events ADD COLUMN linked_deck_id TEXT`,
    ],
  },
  {
    version: 13,
    up: [
      `ALTER TABLE flashcard_decks ADD COLUMN linked_event_id TEXT`,
    ],
  },
  {
    version: 14,
    up: [
      `UPDATE flashcard_decks SET linked_event_id = (SELECT id FROM calendar_events WHERE linked_deck_id = flashcard_decks.id LIMIT 1) WHERE EXISTS (SELECT 1 FROM calendar_events WHERE linked_deck_id = flashcard_decks.id)`
    ],
  },
  {
    version: 15,
    up: [
      `CREATE TABLE IF NOT EXISTS audio_transcripts (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL UNIQUE,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        summary_text TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        FOREIGN KEY (recording_id) REFERENCES audio_recordings(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audio_transcripts_recording ON audio_transcripts(recording_id)`,
      `CREATE TABLE IF NOT EXISTS youtube_transcripts (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL UNIQUE,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        summary_text TEXT,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (video_id) REFERENCES youtube_videos(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_youtube_transcripts_video ON youtube_transcripts(video_id)`,
      `INSERT OR IGNORE INTO audio_transcripts (id, recording_id, transcript_text, summary_text, is_backed_up) SELECT id, id, transcript_text, summary_text, COALESCE(is_backed_up, 0) FROM audio_recordings WHERE transcript_text IS NOT NULL AND transcript_text != ''`,
      `INSERT OR IGNORE INTO youtube_transcripts (id, video_id, transcript_text, summary_text, is_backed_up) SELECT id, id, transcript_text, summary_text, COALESCE(is_backed_up, 0) FROM youtube_videos WHERE transcript_text IS NOT NULL AND transcript_text != ''`,
      `UPDATE audio_transcripts SET cloud_url = (SELECT cloud_url FROM audio_recordings WHERE audio_recordings.id = audio_transcripts.recording_id) WHERE cloud_url IS NULL`,
      `UPDATE youtube_transcripts SET cloud_url = (SELECT cloud_url FROM youtube_videos WHERE youtube_videos.id = youtube_transcripts.video_id) WHERE cloud_url IS NULL`,
    ],
  },
  {
    version: 16,
    up: [
      `CREATE TABLE IF NOT EXISTS ai_chats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        subject_id TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        content TEXT NOT NULL,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_chats_user ON ai_chats(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_ai_chats_subject ON ai_chats(subject_id)`,
      `CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `ALTER TABLE flashcards ADD COLUMN ease_factor REAL`,
      `ALTER TABLE flashcards ADD COLUMN interval_days INTEGER`,
      `ALTER TABLE flashcards ADD COLUMN repetitions INTEGER DEFAULT 0`,
      `ALTER TABLE flashcards ADD COLUMN next_review_at TEXT`,
      `ALTER TABLE flashcards ADD COLUMN fsrs_stability REAL`,
      `ALTER TABLE flashcards ADD COLUMN fsrs_difficulty REAL`,
      `ALTER TABLE flashcard_decks ADD COLUMN avg_ease_factor REAL`,
      `ALTER TABLE flashcard_decks ADD COLUMN total_reviews INTEGER DEFAULT 0`,
      `ALTER TABLE flashcard_decks ADD COLUMN last_reviewed_at TEXT`,
    ],
  },
  {
    version: 17,
    up: [
      `ALTER TABLE flashcard_decks ADD COLUMN is_backed_up INTEGER DEFAULT 0`,
      `ALTER TABLE flashcard_decks ADD COLUMN cloud_url TEXT`,
    ],
  },
  {
    version: 18,
    up: [
      `UPDATE flashcard_decks SET is_backed_up = 0`,
      `UPDATE flashcards SET is_backed_up = 0`,
    ],
  },
];

export default migrations;
