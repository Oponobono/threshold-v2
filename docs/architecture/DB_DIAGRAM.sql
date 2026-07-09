-- ============================================================================
-- THRESHOLD - Database Diagram (PostgreSQL DDL)
-- Generado para importar en LucidChart, DataGrip, DbVisualizer, etc.
-- ============================================================================
-- Uso: Importa este archivo SQL en tu herramienta de diagramas para
--      visualizar automáticamente todas las tablas y relaciones.
-- ============================================================================

-- ============================================================================
-- 1. MÓDULO DE USUARIOS Y ACCESO
-- ============================================================================

CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    name                TEXT,
    lastname            TEXT,
    username            TEXT UNIQUE,
    major               TEXT,
    university          TEXT,
    semester            TEXT,
    study_goal          TEXT,
    reference_language  TEXT,
    biometric_token     TEXT,
    status              VARCHAR(20) DEFAULT 'active',
    deletion_date       TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    share_pin           VARCHAR(8) UNIQUE,
    display_name        TEXT,
    profile_image       TEXT,
    active_grading_version_id INTEGER,
    approval_threshold  REAL DEFAULT 50.0
);

CREATE TABLE deleted_users (
    id                  SERIAL PRIMARY KEY,
    original_user_id    INTEGER,
    email               TEXT,
    name                TEXT,
    lastname            TEXT,
    deleted_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_visitors (
    device_id           TEXT PRIMARY KEY,
    first_seen_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_visit_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    visit_count         INTEGER DEFAULT 1
);

CREATE TABLE two_factor_auth (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    enabled             INTEGER DEFAULT 0,
    secret              TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lms_accounts (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform            TEXT NOT NULL,
    instance_url        TEXT NOT NULL,
    username            TEXT NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feedback_messages (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message             TEXT NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. MÓDULO ACADÉMICO (Subjects & Scheduling)
-- ============================================================================

CREATE TABLE subjects (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    code                TEXT NOT NULL DEFAULT '',
    name                TEXT NOT NULL,
    credits             INTEGER,
    professor           TEXT,
    color               TEXT DEFAULT '#CCCCCC',
    icon                TEXT DEFAULT 'book-outline',
    target_grade        REAL,
    folder_path         TEXT
);

CREATE TABLE schedules (
    id                  SERIAL PRIMARY KEY,
    subject_id          INTEGER NOT NULL REFERENCES subjects(id),
    day_of_week         INTEGER NOT NULL,
    start_time          TEXT NOT NULL,
    end_time            TEXT NOT NULL
);

CREATE TABLE calendar_events (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    event_type          TEXT NOT NULL,
    description         TEXT,
    start_date          TEXT NOT NULL,
    end_date            TEXT NOT NULL,
    start_time          TEXT,
    end_time            TEXT,
    all_day             INTEGER DEFAULT 0,
    create_study_plan   INTEGER DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE study_sessions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    subject_id          INTEGER REFERENCES subjects(id),
    session_type        VARCHAR(20) NOT NULL,
    config_value        INTEGER,
    duration_seconds    INTEGER NOT NULL,
    performance_rating  INTEGER,
    start_timestamp     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. MÓDULO DE EVALUACIONES Y CALIFICACIONES (Grading Engine)
-- ============================================================================

CREATE TABLE grading_systems (
    id                  SERIAL PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    type                TEXT NOT NULL,
    mode                TEXT NOT NULL,
    direction           TEXT NOT NULL,
    country_code        TEXT,
    is_system_seeded    INTEGER DEFAULT 0,
    is_custom           INTEGER DEFAULT 0,
    created_by_user_id  INTEGER REFERENCES users(id),
    based_on_system_id  INTEGER REFERENCES grading_systems(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grading_versions (
    id                  SERIAL PRIMARY KEY,
    grading_system_id   INTEGER NOT NULL REFERENCES grading_systems(id) ON DELETE CASCADE,
    owner_type          TEXT NOT NULL,
    owner_id            TEXT,
    min_value           REAL,
    max_value           REAL,
    passing_value       REAL,
    precision           INTEGER DEFAULT 2,
    valid_from          TIMESTAMP,
    valid_to            TIMESTAMP,
    is_active           INTEGER DEFAULT 1,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at         TIMESTAMP
);

CREATE TABLE grading_scales (
    id                  SERIAL PRIMARY KEY,
    grading_version_id  INTEGER NOT NULL REFERENCES grading_versions(id) ON DELETE CASCADE,
    min_score           REAL NOT NULL,
    max_score           REAL NOT NULL,
    label               TEXT NOT NULL,
    gpa_equivalent      REAL,
    color               TEXT,
    sort_order          INTEGER DEFAULT 0,
    is_passing          INTEGER DEFAULT 1,
    display_color       TEXT,
    display_short_label TEXT,
    display_priority    INTEGER DEFAULT 0
);

CREATE TABLE grading_periods (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    period_type         TEXT NOT NULL,
    start_date          TIMESTAMP,
    end_date            TIMESTAMP,
    is_active           INTEGER DEFAULT 1,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessments (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    subject_id          INTEGER NOT NULL REFERENCES subjects(id),
    name                TEXT NOT NULL,
    type                TEXT,
    date                TEXT,
    weight              TEXT,
    out_of              INTEGER,
    is_completed        INTEGER DEFAULT 0,
    grade_value         REAL,
    score               REAL,
    normalized_value    REAL,
    percentage          REAL,
    period_id           INTEGER,
    category_id         INTEGER
);

CREATE TABLE assessment_categories (
    id                  SERIAL PRIMARY KEY,
    subject_id          INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    weight              REAL,
    drop_lowest         INTEGER DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assessment_results (
    id                  SERIAL PRIMARY KEY,
    assessment_id       INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_value           REAL,
    normalized_value    DECIMAL(6,5),
    grading_version_id  INTEGER NOT NULL REFERENCES grading_versions(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE grade_history (
    id                  SERIAL PRIMARY KEY,
    assessment_result_id INTEGER NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
    old_raw_value       REAL,
    new_raw_value       REAL,
    changed_by          INTEGER,
    changed_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason              TEXT
);

CREATE TABLE subject_grade_snapshots (
    id                  SERIAL PRIMARY KEY,
    subject_id          INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    final_raw_value     REAL,
    final_normalized_value DECIMAL(6,5),
    grading_version_id  INTEGER NOT NULL REFERENCES grading_versions(id),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subject_threshold_overrides (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    threshold           REAL NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, subject_id)
);

-- ============================================================================
-- 4. MÓDULO DE ARCHIVOS Y MULTIMEDIA
-- ============================================================================

CREATE TABLE photos (
    id                  SERIAL PRIMARY KEY,
    subject_id          INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    local_uri           TEXT NOT NULL,
    es_favorita         INTEGER DEFAULT 0,
    ocr_text            TEXT,
    tags                TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cloud_url           TEXT,
    is_backed_up        INTEGER DEFAULT 0,
    group_id            TEXT
);

CREATE TABLE gallery_items (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    uri                 TEXT NOT NULL,
    subject             TEXT,
    date                TEXT,
    time                TEXT,
    ocr_text            TEXT,
    is_starred          INTEGER DEFAULT 0,
    cloud_url           TEXT,
    is_backed_up        INTEGER DEFAULT 0
);

CREATE TABLE scanned_documents (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    name                TEXT,
    local_uri           TEXT NOT NULL,
    ocr_text            TEXT,
    extracted_at        TIMESTAMP,
    cloud_url           TEXT,
    is_backed_up        INTEGER DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audio_recordings (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    name                TEXT,
    local_uri           TEXT NOT NULL,
    duration            INTEGER,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cloud_url           TEXT,
    is_backed_up        INTEGER DEFAULT 0
);

CREATE TABLE audio_transcripts (
    id                  SERIAL PRIMARY KEY,
    recording_id        INTEGER NOT NULL REFERENCES audio_recordings(id) ON DELETE CASCADE,
    transcript_uri      TEXT,
    transcript_text     TEXT,
    summary_uri         TEXT,
    summary_text        TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cloud_url           TEXT,
    is_backed_up        INTEGER DEFAULT 0
);

CREATE TABLE youtube_videos (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    youtube_url         TEXT NOT NULL,
    video_id            TEXT NOT NULL,
    title               TEXT,
    thumbnail_url       TEXT,
    duration            INTEGER,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE youtube_transcripts (
    id                  SERIAL PRIMARY KEY,
    video_id            INTEGER NOT NULL UNIQUE REFERENCES youtube_videos(id) ON DELETE CASCADE,
    transcript_uri      TEXT,
    transcript_text     TEXT,
    summary_uri         TEXT,
    summary_text        TEXT,
    cloud_url           TEXT,
    is_backed_up        INTEGER DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. MÓDULO DE FLASHCARDS Y APRENDIZAJE (Spaced Repetition)
-- ============================================================================

CREATE TABLE flashcard_decks (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT,
    is_public           INTEGER DEFAULT 0,
    total_reviews       INTEGER DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flashcards (
    id                  SERIAL PRIMARY KEY,
    deck_id             INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    front               TEXT NOT NULL DEFAULT '',
    back                TEXT NOT NULL DEFAULT '',
    item_type           TEXT NOT NULL DEFAULT 'flashcard',
    content_json        TEXT,
    hint                TEXT,
    explanation         TEXT,
    status              TEXT DEFAULT 'new',
    view_count          INTEGER DEFAULT 0,
    success_count       INTEGER DEFAULT 0,
    failure_count       INTEGER DEFAULT 0,
    last_review_timestamp TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- SM-2 Spaced Repetition
    sm2_ease_factor     REAL DEFAULT 2.5,
    sm2_interval        INTEGER DEFAULT 1,
    sm2_repetitions     INTEGER DEFAULT 0,
    next_review_date    TIMESTAMP,
    -- FSRS (Free Spaced Repetition Scheduler)
    fsrs_stability      REAL DEFAULT 1,
    fsrs_difficulty     REAL DEFAULT 0.5,
    fsrs_repetitions    INTEGER DEFAULT 0,
    -- Cognitive Load & Atomicity
    word_count          INTEGER DEFAULT 0,
    is_atomic           INTEGER DEFAULT 1,
    parent_card_id      INTEGER,
    atomic_index        INTEGER
);

CREATE TABLE card_logs (
    id                  SERIAL PRIMARY KEY,
    card_id             INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    result              VARCHAR(20),
    response_time_ms    INTEGER,
    difficulty_deduced  VARCHAR(20),
    normalized_time_ms  INTEGER,
    text_length_words   INTEGER,
    timestamp           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE card_snoozes (
    id                  SERIAL PRIMARY KEY,
    card_id             INTEGER NOT NULL UNIQUE REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snoozed_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resume_at           TIMESTAMP NOT NULL,
    snooze_duration_minutes INTEGER NOT NULL,
    reason              TEXT
);

CREATE TABLE review_predictions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id             INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    predicted_next_review TIMESTAMP,
    prediction_confidence REAL,
    notification_sent   INTEGER DEFAULT 0,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. MÓDULO DE ANALÍTICA
-- ============================================================================

CREATE TABLE learning_analytics (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    total_cards         INTEGER DEFAULT 0,
    total_reviews       INTEGER DEFAULT 0,
    correct_reviews     INTEGER DEFAULT 0,
    incorrect_reviews   INTEGER DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0,
    mastery_percentage  REAL DEFAULT 0,
    last_updated        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, subject_id)
);

CREATE TABLE card_difficulty_analytics (
    id                  SERIAL PRIMARY KEY,
    card_id             INTEGER NOT NULL UNIQUE REFERENCES flashcards(id) ON DELETE CASCADE,
    total_attempts      INTEGER DEFAULT 0,
    failure_rate        REAL DEFAULT 0,
    avg_response_time_ms REAL DEFAULT 0,
    problem_flag        INTEGER DEFAULT 0,
    last_analyzed       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. MÓDULO DE SOCIAL / GRUPOS / COMPARTIR
-- ============================================================================

CREATE TABLE groups (
    id                  SERIAL PRIMARY KEY,
    group_pin_id        TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    creator_user_id     INTEGER NOT NULL REFERENCES users(id),
    is_public           BOOLEAN DEFAULT TRUE,
    password            TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_memberships (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    group_pin_id        TEXT NOT NULL,
    role                VARCHAR(20) DEFAULT 'member',
    joined_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shared_decks (
    id                  SERIAL PRIMARY KEY,
    deck_id             INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    shared_by_user_id   INTEGER NOT NULL REFERENCES users(id),
    shared_to_user_id   INTEGER NOT NULL REFERENCES users(id),
    shared_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(deck_id, shared_to_user_id)
);

CREATE TABLE shared_group_decks (
    id                  SERIAL PRIMARY KEY,
    deck_id             INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
    shared_by_user_id   INTEGER NOT NULL REFERENCES users(id),
    group_pin_id        TEXT NOT NULL,
    shared_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(deck_id, group_pin_id)
);

-- ============================================================================
-- 8. MÓDULO DE AI CHAT
-- ============================================================================

CREATE TABLE ai_chat_sessions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    subject_id          INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    title               TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_chat_messages (
    id                  SERIAL PRIMARY KEY,
    session_id          INTEGER NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role                VARCHAR(20) NOT NULL,
    content             TEXT NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
