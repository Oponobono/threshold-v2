# Base de Datos

## Arquitectura SQLite + PostgreSQL

```
DESARROLLO (local)                  PRODUCCIÓN (cloud)
┌─────────────────────┐            ┌─────────────────────┐
│ SQLite (fichero .db)│◄──────────►│ PostgreSQL (RDS)    │
│ Sin configuración   │ mismo API  │ Escalable           │
│ Rápido para tests   │            │ Multi-usuario       │
└─────────┬───────────┘            └──────────┬───────────┘
          │                                   │
          └─────────── Adaptador db.js ────────┘
                      ├─ Placeholder: ? → $1
                      ├─ RETURNING automático en INSERT
                      └─ Connection pooling
```

El adaptador `backend/database/connection.js` detecta `DATABASE_URL` o `NODE_ENV` y elige el motor.
`backend/database/schema.js` define cada tabla con sintaxis para ambos motores (45 tablas).

## Backend: 45 Tablas

### Usuarios y Acceso

| Tabla | PK | Propósito |
|-------|----|-----------|
| `users` | TEXT (UUID) | Usuarios registrados |
| `deleted_users` | TEXT (UUID) | Auditoría de bajas |
| `app_visitors` | TEXT (device_id) | Visitantes anónimos |
| `two_factor_auth` | INTEGER AUTOINCREMENT | 2FA por usuario |
| `feedback_messages` | INTEGER AUTOINCREMENT | Feedback de usuarios |

### Académico

| Tabla | PK | FK | Propósito |
|-------|----|----|-----------|
| `subjects` | TEXT | user_id, course_id | Materias del usuario |
| `courses` | TEXT | user_id | Cursos (Course Hub) |
| `schedules` | TEXT | user_id, subject_id | Horarios semanales |

### Evaluaciones y Calificaciones

| Tabla | PK | FK | Propósito |
|-------|----|----|-----------|
| `assessments` | TEXT | user_id, subject_id | Evaluaciones (quiz/exam/homework/project) |
| `assessment_categories` | TEXT | subject_id | Categorías ponderadas |
| `assessment_results` | TEXT | assessment_id, user_id, grading_version_id | Calificaciones |
| `assessment_files` | TEXT | assessment_id | Archivos adjuntos |
| `grade_history` | TEXT | assessment_result_id | Auditoría de cambios |
| `subject_grade_snapshots` | TEXT | subject_id, user_id, grading_version_id | Instantáneas de nota final |
| `grading_systems` | INTEGER AUTOINCREMENT | — | Sistemas de calificación |
| `grading_versions` | INTEGER AUTOINCREMENT | grading_system_id | Versiones por usuario/materia |
| `grading_scales` | INTEGER AUTOINCREMENT | grading_version_id | Equivalencias (score → label → GPA) |
| `grading_periods` | TEXT | user_id | Períodos académicos |
| `subject_threshold_overrides` | TEXT | user_id, subject_id | Umbral de aprobación |

### Multimedia y Archivos

| Tabla | PK | FK | Asset Pipeline | Propósito |
|-------|----|----|----------------|-----------|
| `photos` | TEXT | user_id, subject_id | ✓ (v25) | Fotos de pizarras/apuntes |
| `scanned_documents` | TEXT | user_id, subject_id | ✓ (v25) | Documentos escaneados |
| `audio_recordings` | TEXT | user_id, subject_id | ✓ (v25) | Grabaciones de clase |
| `audio_transcripts` | TEXT | recording_id | — | Transcripciones de audio |
| `youtube_videos` | TEXT | user_id, subject_id | — | Videos de YouTube vinculados |
| `youtube_transcripts` | TEXT | video_id (UNIQUE) | — | Subtítulos/transcripciones |
| `gallery_items` | TEXT | user_id | — | Galería híbrida |

### Flashcards y Aprendizaje

| Tabla | PK | FK | Propósito |
|-------|----|----|-----------|
| `flashcard_decks` | TEXT | user_id, subject_id, linked_event_id | Mazos de tarjetas |
| `flashcards` | TEXT | deck_id | Tarjetas individuales (SM-2 + FSRS) |
| `card_logs` | TEXT | card_id, user_id | Registro de respuestas |
| `card_snoozes` | TEXT | card_id (UNIQUE) | Tarjetas pospuestas |
| `card_difficulty_analytics` | TEXT | card_id (UNIQUE) | Analítica de dificultad |
| `review_predictions` | TEXT | user_id, card_id | Predicciones de repaso |
| `learning_analytics` | TEXT | user_id, subject_id | Estadísticas por materia (UNIQUE) |
| `study_sessions` | TEXT | user_id, subject_id | Sesiones de estudio |

### Social y Grupos

| Tabla | PK | FK | Propósito |
|-------|----|----|-----------|
| `groups` | TEXT | creator_user_id | Grupos de estudio |
| `group_memberships` | TEXT | user_id | Membresías |
| `shared_decks` | TEXT | deck_id, shared_by/to_user_id | Mazos compartidos (1:1) |
| `shared_group_decks` | TEXT | deck_id, shared_by_user_id | Mazos compartidos a grupo |

### AI / Zyren

| Tabla | PK | FK | Propósito |
|-------|----|----|-----------|
| `ai_chats` | TEXT | user_id, subject_id | Mensajes de chat planos |
| `ai_chat_sessions` | TEXT | user_id, subject_id | Sesiones de chat |
| `ai_chat_messages` | TEXT | session_id | Mensajes por sesión |

### Calendario

| Tabla | PK | FK | Propósito |
|-------|----|----|-----------|
| `calendar_events` | TEXT | user_id, subject_id, linked_deck_id | Eventos con linked_deck_id |

### LMS

| Tabla | PK | FK | Propósito |
|-------|----|----|-----------|
| `lms_accounts` | TEXT | user_id | Cuentas Blackboard/Moodle |

### Infraestructura de Sync

| Tabla | PK | Propósito |
|-------|----|-----------|
| `sync_version` | INTEGER (id=1) | Contador monotónico global |
| `sync_deletions` | INTEGER AUTOINCREMENT | Borrados soft con deletion_version |
| `sync_queue` | INTEGER AUTOINCREMENT | Cola de operaciones offline (mobile only) |
| `sync_journal` | INTEGER AUTOINCREMENT | Bitácora de ciclos de sync (mobile only) |
| `sync_debug_logs` | INTEGER AUTOINCREMENT | Trazas con trace_id (mobile only) |

### Convenciones de PK

- **Entidades de negocio**: `TEXT` con UUID v4
- **Tablas de sistema**: `INTEGER AUTOINCREMENT` (sync, auditoría, 2FA, feedback, grading lookups)
- **FK**: `{tabla}_id` en snake_case
- **Timestamps**: `created_at`, `updated_at`, `deleted_at`
- **Soft delete**: `deleted_at TEXT` + `sync_deletions` para entidades sincronizables

## Mobile: 28+ Tablas (29 Migraciones)

El cliente móvil tiene su propio esquema SQLite, evolucionado a través de migraciones versionadas en
`mobile/src/services/database/migrations.ts`.

| Versión | Cambios |
|---------|---------|
| 1 | Schema inicial: users, subjects, assessments, assessment_categories, schedules, flashcard_decks, flashcards, card_logs, study_sessions, photos, audio_recordings, youtube_videos, scanned_documents, calendar_events, sync_queue |
| 2 | youtube_videos: is_backed_up, cloud_url |
| 3 | assessment_files |
| 4 | audio_recordings/youtube_videos: summary_text |
| 5 | grade_history |
| 6 | assessment_files (re-creada) |
| 7 | courses + subject columns (course_id, external_url, total_lessons, completed_lessons, next_micro_milestone) |
| 8 | direction en flashcards |
| 9 | source_context en flashcards |
| 10 | courses: main_url, deep_link_url, instructor, total_hours, status, global_notes, tags |
| 11 | courses: total_classes, completed_classes |
| 12 | calendar_events: linked_deck_id |
| 13 | flashcard_decks: linked_event_id |
| 14 | Migración linked_event_id desde calendar_events |
| 15 | audio_transcripts + youtube_transcripts (separadas de tablas padre) |
| 16 | ai_chats + user_preferences + SM-2/FSRS en flashcards + avg_ease_factor/total_reviews en decks |
| 17 | flashcard_decks: is_backed_up, cloud_url |
| 18 | flashcard_decks: is_backed_up = 0 |
| 19 | sync_deletions |
| 20 | sync_journal |
| 21 | version_number, last_modified_by, deleted_at en 10 tablas syncables |
| 22 | sync_debug_logs + trace_id en sync_queue |
| 23 | flashcards: is_backed_up |
| 24 | grading_periods + lms_accounts + subject_threshold_overrides |
| 25 | Asset pipeline: photos, audio_recordings, scanned_documents (asset_state, checksum, filename, mime_type, file_size, sync_version, etc.) |
| 26 | users: columnas completas (lastname, username, major, university, etc.) + version_number |
| 27 | subject_threshold_overrides: recreada con schema corregido |
| 28 | assessment_categories + audio/youtube_transcripts: sync_version, version_number, deleted_at |
| 29 | assessment_files: deleted_at, sync_version, version_number |

## Diferencias Backend vs Mobile

| Aspecto | Backend (schema.js) | Mobile (migrations.ts) |
|---------|--------------------|----------------------|
| Tablas | 45 | 28+ |
| PK entidades | TEXT (UUID) | TEXT (UUID) |
| PK sistema | INTEGER AUTOINCREMENT | INTEGER AUTOINCREMENT |
| Migraciones | Column-level (auto) + Script-level (manual) | 29 versiones numeradas |
| Sync infra | sync_version, sync_deletions | sync_queue, sync_journal, sync_debug_logs |
| Tablas backend-only | grading_systems, grading_versions, grading_scales, assessment_results, subject_grade_snapshots, card_difficulty_analytics, review_predictions, learning_analytics, shared_decks, groups, group_memberships, two_factor_auth, feedback_messages, app_visitors, deleted_users | — |
| Tablas mobile-only | — | sync_queue, sync_journal, sync_debug_logs, user_preferences |

## Sync Coverage

### Initial Sync (10 entidades)

`subjects`, `courses`, `assessments`, `assessment_categories`, `schedules`, `flashcard_decks`,
`calendar_events`, `grading_periods`, `lms_accounts`, `subject_threshold_overrides`

### Delta Sync (12 tablas + 4 especiales)

**12 tablas con sync_version**: subjects, courses, assessments, schedules, flashcard_decks,
calendar_events, grading_periods, lms_accounts, subject_threshold_overrides, photos,
audio_recordings, scanned_documents

**4 tablas por JOIN**: assessment_categories (JOIN subjects), audio_transcripts (JOIN audio_recordings),
youtube_videos (JOIN subjects por user_id), youtube_transcripts (JOIN youtube_videos)

## Migraciones

### Backend

Dos sistemas:

1. **Column-level** (`backend/database/migrations.js`): detecta columnas faltantes vía `PRAGMA table_info`
   y aplica `ALTER TABLE ADD COLUMN` automáticamente al iniciar.
2. **Script-level** (`backend/database/migrations/*.js`): scripts manuales para cambios estructurales.

### Mobile

29 migraciones versionadas en `mobile/src/services/database/migrations.ts`. Se ejecutan en orden,
verifican `PRAGMA table_info` antes de cada `ALTER TABLE`, y usan `PRAGMA foreign_keys = ON`.
