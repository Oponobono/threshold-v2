// Definición centralizada del esquema de la base de datos
const tableSchema = {
  users: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        lastname TEXT,
        username TEXT UNIQUE,
        major TEXT,
        university TEXT,
        semester TEXT,
        study_goal TEXT,
        reference_language TEXT,
        biometric_token TEXT,
        status VARCHAR(20) DEFAULT 'active',
        deletion_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        share_pin VARCHAR(8) UNIQUE,
        display_name TEXT,
        profile_image TEXT
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        lastname TEXT,
        username TEXT UNIQUE,
        major TEXT,
        university TEXT,
        semester TEXT,
        study_goal TEXT,
        reference_language TEXT,
        biometric_token TEXT,
        status VARCHAR(20) DEFAULT 'active',
        deletion_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        share_pin VARCHAR(8) UNIQUE,
        display_name TEXT,
        profile_image TEXT
      )
    `,
    columns: [
      { name: 'name', type: 'TEXT' },
      { name: 'lastname', type: 'TEXT' },
      { name: 'username', type: 'TEXT' },
      { name: 'major', type: 'TEXT' },
      { name: 'university', type: 'TEXT' },
      { name: 'semester', type: 'TEXT' },
      { name: 'study_goal', type: 'TEXT' },
      { name: 'reference_language', type: 'TEXT' },
      { name: 'biometric_token', type: 'TEXT' },
      { name: 'status', type: "VARCHAR(20) DEFAULT 'active'" },
      { name: 'deletion_date', type: 'TIMESTAMP' },
      { name: 'share_pin', type: 'VARCHAR(8)' },
      { name: 'display_name', type: 'TEXT' },
      { name: 'profile_image', type: 'TEXT' },
      { name: 'active_grading_version_id', type: 'INTEGER' },
      { name: 'approval_threshold', type: 'REAL DEFAULT 50.0' }
    ]
  },
  deleted_users: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS deleted_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_user_id INTEGER,
        email TEXT,
        name TEXT,
        lastname TEXT,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS deleted_users (
        id SERIAL PRIMARY KEY,
        original_user_id INTEGER,
        email TEXT,
        name TEXT,
        lastname TEXT,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  app_visitors: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS app_visitors (
        device_id TEXT PRIMARY KEY,
        first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        visit_count INTEGER DEFAULT 1
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS app_visitors (
        device_id TEXT PRIMARY KEY,
        first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_visit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        visit_count INTEGER DEFAULT 1
      )
    `
  },
  subjects: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        credits INTEGER,
        professor TEXT,
        color TEXT DEFAULT '#CCCCCC',
        icon TEXT DEFAULT 'book-outline',
        target_grade REAL,
        folder_path TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        code TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        credits INTEGER,
        professor TEXT,
        color TEXT DEFAULT '#CCCCCC',
        icon TEXT DEFAULT 'book-outline',
        target_grade REAL,
        folder_path TEXT
      )
    `,
    columns: [
      { name: 'color', type: "TEXT DEFAULT '#CCCCCC'" },
      { name: 'icon', type: "TEXT DEFAULT 'book-outline'" },
      { name: 'target_grade', type: 'REAL' },
      { name: 'folder_path', type: 'TEXT' },
    ]
  },
  photos: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        local_uri TEXT NOT NULL,
        es_favorita INTEGER DEFAULT 0,
        ocr_text TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
        local_uri TEXT NOT NULL,
        es_favorita INTEGER DEFAULT 0,
        ocr_text TEXT,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0
      )
    `,
    columns: [
      { name: 'ocr_text', type: 'TEXT' },
      { name: 'tags', type: 'TEXT' },
      { name: 'cloud_url', type: 'TEXT' },
      { name: 'is_backed_up', type: 'INTEGER DEFAULT 0' },
      { name: 'group_id', type: 'TEXT' }
    ]
  },
  assessments: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        date TEXT,
        weight TEXT,
        out_of INTEGER,
        is_completed INTEGER DEFAULT 0,
        grade_value REAL,
        score REAL,
        normalized_value REAL,
        percentage REAL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS assessments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject_id INTEGER NOT NULL REFERENCES subjects(id),
        name TEXT NOT NULL,
        type TEXT,
        date TEXT,
        weight TEXT,
        out_of INTEGER,
        is_completed INTEGER DEFAULT 0,
        grade_value REAL,
        score REAL,
        normalized_value REAL,
        percentage REAL
      )
    `,
    columns: [
      { name: 'user_id', type: 'INTEGER NOT NULL' },
      { name: 'out_of', type: 'INTEGER' },
      { name: 'is_completed', type: 'INTEGER DEFAULT 0' },
      { name: 'period_id', type: 'INTEGER' },
      { name: 'category_id', type: 'INTEGER' },
      { name: 'grade_value', type: 'REAL' },
      { name: 'score', type: 'REAL' },
      { name: 'normalized_value', type: 'REAL' },
      { name: 'percentage', type: 'REAL' }
    ]
  },
  gallery_items: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS gallery_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        uri TEXT NOT NULL,
        subject TEXT,
        date TEXT,
        time TEXT,
        ocr_text TEXT,
        is_starred BOOLEAN DEFAULT 0,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS gallery_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        uri TEXT NOT NULL,
        subject TEXT,
        date TEXT,
        time TEXT,
        ocr_text TEXT,
        is_starred INTEGER DEFAULT 0,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0
      )
    `
  },
  scanned_documents: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS scanned_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        name TEXT,
        local_uri TEXT NOT NULL,
        ocr_text TEXT,
        extracted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS scanned_documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        name TEXT,
        local_uri TEXT NOT NULL,
        ocr_text TEXT,
        extracted_at TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'ocr_text', type: 'TEXT' },
      { name: 'extracted_at', type: 'TIMESTAMP' },
      { name: 'cloud_url', type: 'TEXT' },
      { name: 'is_backed_up', type: 'INTEGER DEFAULT 0' }
    ]
  },
  audio_recordings: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS audio_recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        name TEXT,
        local_uri TEXT NOT NULL,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS audio_recordings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        name TEXT,
        local_uri TEXT NOT NULL,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0
      )
    `,
    columns: [
      { name: 'name', type: 'TEXT' },
      { name: 'cloud_url', type: 'TEXT' },
      { name: 'is_backed_up', type: 'INTEGER DEFAULT 0' },
    ]
  },
  audio_transcripts: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS audio_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recording_id INTEGER NOT NULL,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        summary_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        FOREIGN KEY (recording_id) REFERENCES audio_recordings(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS audio_transcripts (
        id SERIAL PRIMARY KEY,
        recording_id INTEGER NOT NULL REFERENCES audio_recordings(id) ON DELETE CASCADE,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        summary_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0
      )
    `,
    columns: [
      { name: 'transcript_text', type: 'TEXT' },
      { name: 'summary_text', type: 'TEXT' },
      { name: 'cloud_url', type: 'TEXT' },
      { name: 'is_backed_up', type: 'INTEGER DEFAULT 0' },
    ]
  },
  youtube_videos: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS youtube_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        youtube_url TEXT NOT NULL,
        video_id TEXT NOT NULL,
        title TEXT,
        thumbnail_url TEXT,
        duration INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS youtube_videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        youtube_url TEXT NOT NULL,
        video_id TEXT NOT NULL,
        title TEXT,
        thumbnail_url TEXT,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  youtube_transcripts: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS youtube_transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        summary_text TEXT,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES youtube_videos(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS youtube_transcripts (
        id SERIAL PRIMARY KEY,
        video_id INTEGER NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
        transcript_uri TEXT,
        transcript_text TEXT,
        summary_uri TEXT,
        summary_text TEXT,
        cloud_url TEXT,
        is_backed_up INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'transcript_text', type: 'TEXT' },
      { name: 'summary_text', type: 'TEXT' },
      { name: 'cloud_url', type: 'TEXT' },
      { name: 'is_backed_up', type: 'INTEGER DEFAULT 0' },
    ]
  },
  flashcard_decks: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS flashcard_decks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS flashcard_decks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        is_public INTEGER DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'is_public', type: 'BOOLEAN DEFAULT false' },
      { name: 'total_reviews', type: 'INTEGER DEFAULT 0' }
    ]
  },
  flashcards: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_id INTEGER NOT NULL,
        front TEXT NOT NULL DEFAULT '',
        back TEXT NOT NULL DEFAULT '',
        item_type TEXT NOT NULL DEFAULT 'flashcard',
        content_json TEXT,
        hint TEXT,
        explanation TEXT,
        status TEXT DEFAULT 'new',
        view_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_review_timestamp DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS flashcards (
        id SERIAL PRIMARY KEY,
        deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
        front TEXT NOT NULL DEFAULT '',
        back TEXT NOT NULL DEFAULT '',
        item_type TEXT NOT NULL DEFAULT 'flashcard',
        content_json TEXT,
        hint TEXT,
        explanation TEXT,
        status TEXT DEFAULT 'new',
        view_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_review_timestamp TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'view_count', type: 'INTEGER DEFAULT 0' },
      { name: 'success_count', type: 'INTEGER DEFAULT 0' },
      { name: 'failure_count', type: 'INTEGER DEFAULT 0' },
      { name: 'last_review_timestamp', type: 'TIMESTAMP' },
      { name: 'item_type', type: "TEXT NOT NULL DEFAULT 'flashcard'" },
      { name: 'content_json', type: 'TEXT' },
      { name: 'hint', type: 'TEXT' },
      { name: 'explanation', type: 'TEXT' },
      // SM-2 Spaced Repetition Fields
      { name: 'sm2_ease_factor', type: 'REAL DEFAULT 2.5' },
      { name: 'sm2_interval', type: 'INTEGER DEFAULT 1' },
      { name: 'sm2_repetitions', type: 'INTEGER DEFAULT 0' },
      { name: 'next_review_date', type: 'TIMESTAMP' },
      // FSRS (Free Spaced Repetition Scheduler) Fields - Modern alternative to SM-2
      { name: 'fsrs_stability', type: 'REAL DEFAULT 1' },
      { name: 'fsrs_difficulty', type: 'REAL DEFAULT 0.5' },
      { name: 'fsrs_repetitions', type: 'INTEGER DEFAULT 0' },
      // Cognitive Load & Atomicity
      { name: 'word_count', type: 'INTEGER DEFAULT 0' },
      { name: 'is_atomic', type: 'INTEGER DEFAULT 1' },
      { name: 'parent_card_id', type: 'INTEGER' },
      { name: 'atomic_index', type: 'INTEGER' }
    ]
  },
  card_logs: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS card_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        result VARCHAR(20),
        response_time_ms INTEGER,
        difficulty_deduced VARCHAR(20),
        normalized_time_ms INTEGER,
        text_length_words INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS card_logs (
        id SERIAL PRIMARY KEY,
        card_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        result VARCHAR(20),
        response_time_ms INTEGER,
        difficulty_deduced VARCHAR(20),
        normalized_time_ms INTEGER,
        text_length_words INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'difficulty_deduced', type: 'VARCHAR(20)' },
      { name: 'normalized_time_ms', type: 'INTEGER' },
      { name: 'text_length_words', type: 'INTEGER' }
    ]
  },
  learning_analytics: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS learning_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        total_cards INTEGER DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        correct_reviews INTEGER DEFAULT 0,
        incorrect_reviews INTEGER DEFAULT 0,
        avg_response_time_ms REAL DEFAULT 0,
        mastery_percentage REAL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE(user_id, subject_id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS learning_analytics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        total_cards INTEGER DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        correct_reviews INTEGER DEFAULT 0,
        incorrect_reviews INTEGER DEFAULT 0,
        avg_response_time_ms REAL DEFAULT 0,
        mastery_percentage REAL DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, subject_id)
      )
    `
  },
  card_difficulty_analytics: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS card_difficulty_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL,
        total_attempts INTEGER DEFAULT 0,
        failure_rate REAL DEFAULT 0,
        avg_response_time_ms REAL DEFAULT 0,
        problem_flag INTEGER DEFAULT 0,
        last_analyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE,
        UNIQUE(card_id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS card_difficulty_analytics (
        id SERIAL PRIMARY KEY,
        card_id INTEGER NOT NULL UNIQUE REFERENCES flashcards(id) ON DELETE CASCADE,
        total_attempts INTEGER DEFAULT 0,
        failure_rate REAL DEFAULT 0,
        avg_response_time_ms REAL DEFAULT 0,
        problem_flag INTEGER DEFAULT 0,
        last_analyzed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  review_predictions: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS review_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        card_id INTEGER NOT NULL,
        predicted_next_review DATETIME,
        prediction_confidence REAL,
        notification_sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS review_predictions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
        predicted_next_review TIMESTAMP,
        prediction_confidence REAL,
        notification_sent INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  subject_threshold_overrides: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS subject_threshold_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER NOT NULL,
        threshold REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE(user_id, subject_id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS subject_threshold_overrides (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        threshold REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, subject_id)
      )
    `,
    columns: [
      { name: 'user_id', type: 'INTEGER NOT NULL' },
      { name: 'subject_id', type: 'INTEGER NOT NULL' },
      { name: 'threshold', type: 'REAL NOT NULL' }
    ]
  },
  two_factor_auth: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS two_factor_auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 0,
        secret TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS two_factor_auth (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        enabled INTEGER DEFAULT 0,
        secret TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'user_id', type: 'INTEGER NOT NULL' },
      { name: 'enabled', type: 'INTEGER DEFAULT 0' },
      { name: 'secret', type: 'TEXT' }
    ]
  },
  lms_accounts: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS lms_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        instance_url TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS lms_accounts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        instance_url TEXT NOT NULL,
        username TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'user_id', type: 'INTEGER NOT NULL' },
      { name: 'platform', type: 'TEXT NOT NULL' },
      { name: 'instance_url', type: 'TEXT NOT NULL' },
      { name: 'username', type: 'TEXT NOT NULL' }
    ]
  },
  feedback_messages: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS feedback_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS feedback_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'user_id', type: 'INTEGER NOT NULL' },
      { name: 'message', type: 'TEXT NOT NULL' }
    ]
  },
  card_snoozes: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS card_snoozes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        snoozed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resume_at DATETIME NOT NULL,
        snooze_duration_minutes INTEGER NOT NULL,
        reason TEXT,
        FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS card_snoozes (
        id SERIAL PRIMARY KEY,
        card_id INTEGER NOT NULL UNIQUE REFERENCES flashcards(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        snoozed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resume_at TIMESTAMP NOT NULL,
        snooze_duration_minutes INTEGER NOT NULL,
        reason TEXT
      )
    `
  },
  schedules: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER NOT NULL REFERENCES subjects(id),
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL
      )
    `
  },
  calendar_events: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        title TEXT NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        all_day INTEGER DEFAULT 0,
        create_study_plan INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        all_day INTEGER DEFAULT 0,
        create_study_plan INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `,
    columns: [
      { name: 'user_id', type: 'INTEGER NOT NULL' },
      { name: 'subject_id', type: 'INTEGER' },
      { name: 'title', type: 'TEXT NOT NULL' },
      { name: 'event_type', type: 'TEXT NOT NULL' },
      { name: 'description', type: 'TEXT' },
      { name: 'start_date', type: 'TEXT NOT NULL' },
      { name: 'end_date', type: 'TEXT NOT NULL' },
      { name: 'start_time', type: 'TEXT' },
      { name: 'end_time', type: 'TEXT' },
      { name: 'all_day', type: 'INTEGER DEFAULT 0' },
      { name: 'create_study_plan', type: 'INTEGER DEFAULT 0' },
      { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
    ]
  },
  study_sessions: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        session_type VARCHAR(20) NOT NULL,
        config_value INTEGER,
        duration_seconds INTEGER NOT NULL,
        performance_rating INTEGER,
        start_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS study_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id),
        session_type VARCHAR(20) NOT NULL,
        config_value INTEGER,
        duration_seconds INTEGER NOT NULL,
        performance_rating INTEGER,
        start_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  group_memberships: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS group_memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        group_pin_id TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS group_memberships (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        group_pin_id TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },

  groups: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_pin_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        creator_user_id INTEGER NOT NULL,
        is_public INTEGER DEFAULT 1,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_user_id) REFERENCES users(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        group_pin_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        creator_user_id INTEGER NOT NULL REFERENCES users(id),
        is_public BOOLEAN DEFAULT TRUE,
        password TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },

  shared_decks: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS shared_decks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_id INTEGER NOT NULL,
        shared_by_user_id INTEGER NOT NULL,
        shared_to_user_id INTEGER NOT NULL,
        shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by_user_id) REFERENCES users(id),
        FOREIGN KEY (shared_to_user_id) REFERENCES users(id),
        UNIQUE(deck_id, shared_to_user_id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS shared_decks (
        id SERIAL PRIMARY KEY,
        deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
        shared_by_user_id INTEGER NOT NULL REFERENCES users(id),
        shared_to_user_id INTEGER NOT NULL REFERENCES users(id),
        shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(deck_id, shared_to_user_id)
      )
    `
  },
  ai_chat_sessions: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject_id INTEGER,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
        title TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  ai_chat_messages: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  grading_systems: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS grading_systems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        mode TEXT NOT NULL,
        direction TEXT NOT NULL,
        country_code TEXT,
        is_system_seeded INTEGER DEFAULT 0,
        is_custom INTEGER DEFAULT 0,
        created_by_user_id INTEGER,
        based_on_system_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS grading_systems (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        mode TEXT NOT NULL,
        direction TEXT NOT NULL,
        country_code TEXT,
        is_system_seeded INTEGER DEFAULT 0,
        is_custom INTEGER DEFAULT 0,
        created_by_user_id INTEGER REFERENCES users(id),
        based_on_system_id INTEGER REFERENCES grading_systems(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  grading_versions: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS grading_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grading_system_id INTEGER NOT NULL,
        owner_type TEXT NOT NULL,
        owner_id TEXT,
        min_value REAL,
        max_value REAL,
        passing_value REAL,
        precision INTEGER DEFAULT 2,
        valid_from DATETIME,
        valid_to DATETIME,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived_at DATETIME,
        FOREIGN KEY (grading_system_id) REFERENCES grading_systems(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS grading_versions (
        id SERIAL PRIMARY KEY,
        grading_system_id INTEGER NOT NULL REFERENCES grading_systems(id) ON DELETE CASCADE,
        owner_type TEXT NOT NULL,
        owner_id TEXT,
        min_value REAL,
        max_value REAL,
        passing_value REAL,
        precision INTEGER DEFAULT 2,
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        archived_at TIMESTAMP
      )
    `
  },
  grading_scales: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS grading_scales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grading_version_id INTEGER NOT NULL,
        min_score REAL NOT NULL,
        max_score REAL NOT NULL,
        label TEXT NOT NULL,
        gpa_equivalent REAL,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        is_passing INTEGER DEFAULT 1,
        display_color TEXT,
        display_short_label TEXT,
        display_priority INTEGER DEFAULT 0,
        FOREIGN KEY (grading_version_id) REFERENCES grading_versions(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS grading_scales (
        id SERIAL PRIMARY KEY,
        grading_version_id INTEGER NOT NULL REFERENCES grading_versions(id) ON DELETE CASCADE,
        min_score REAL NOT NULL,
        max_score REAL NOT NULL,
        label TEXT NOT NULL,
        gpa_equivalent REAL,
        color TEXT,
        sort_order INTEGER DEFAULT 0,
        is_passing INTEGER DEFAULT 1,
        display_color TEXT,
        display_short_label TEXT,
        display_priority INTEGER DEFAULT 0
      )
    `
  },
  grading_periods: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS grading_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        period_type TEXT NOT NULL,
        start_date DATETIME,
        end_date DATETIME,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS grading_periods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        period_type TEXT NOT NULL,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  assessment_categories: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS assessment_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        weight REAL,
        drop_lowest INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS assessment_categories (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        weight REAL,
        drop_lowest INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  assessment_results: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS assessment_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        raw_value REAL,
        normalized_value DECIMAL(6,5),
        grading_version_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (grading_version_id) REFERENCES grading_versions(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS assessment_results (
        id SERIAL PRIMARY KEY,
        assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        raw_value REAL,
        normalized_value DECIMAL(6,5),
        grading_version_id INTEGER NOT NULL REFERENCES grading_versions(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  grade_history: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS grade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_result_id INTEGER NOT NULL,
        old_raw_value REAL,
        new_raw_value REAL,
        changed_by INTEGER,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        FOREIGN KEY (assessment_result_id) REFERENCES assessment_results(id) ON DELETE CASCADE
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS grade_history (
        id SERIAL PRIMARY KEY,
        assessment_result_id INTEGER NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
        old_raw_value REAL,
        new_raw_value REAL,
        changed_by INTEGER,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT
      )
    `
  },
  subject_grade_snapshots: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS subject_grade_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        final_raw_value REAL,
        final_normalized_value DECIMAL(6,5),
        grading_version_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (grading_version_id) REFERENCES grading_versions(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS subject_grade_snapshots (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        final_raw_value REAL,
        final_normalized_value DECIMAL(6,5),
        grading_version_id INTEGER NOT NULL REFERENCES grading_versions(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
};

module.exports = tableSchema;