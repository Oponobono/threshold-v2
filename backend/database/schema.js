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
        grading_scale TEXT,
        approval_threshold REAL,
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
        grading_scale TEXT,
        approval_threshold REAL,
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
      { name: 'grading_scale', type: 'TEXT' },
      { name: 'approval_threshold', type: 'REAL' },
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
      { name: 'profile_image', type: 'TEXT' }
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
      { name: 'is_backed_up', type: 'INTEGER DEFAULT 0' }
    ]
  },
  assessments: {
    sqlite: `
      CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        date TEXT,
        weight TEXT,
        out_of INTEGER,
        score INTEGER,
        percentage REAL,
        grade_value REAL,
        is_completed INTEGER DEFAULT 0,
        FOREIGN KEY (subject_id) REFERENCES subjects(id)
      )
    `,
    postgres: `
      CREATE TABLE IF NOT EXISTS assessments (
        id SERIAL PRIMARY KEY,
        subject_id INTEGER NOT NULL REFERENCES subjects(id),
        name TEXT NOT NULL,
        type TEXT,
        date TEXT,
        weight TEXT,
        out_of INTEGER,
        score INTEGER,
        percentage REAL,
        grade_value REAL,
        is_completed INTEGER DEFAULT 0
      )
    `,
    columns: [
      { name: 'percentage', type: 'REAL' },
      { name: 'grade_value', type: 'REAL' },
      { name: 'is_completed', type: 'INTEGER DEFAULT 0' },
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
        is_starred BOOLEAN DEFAULT false,
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
        is_public BOOLEAN DEFAULT false,
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
  }
};

module.exports = tableSchema;
