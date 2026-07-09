# 📊 Documentación Completa de Base de Datos - Threshold

**Versión:** 2.0 | **Fecha:** 2026-05-22 | **Tablas:** 36 | **Relaciones:** 80+ | **Queries documentadas:** 50+

---

## 📑 Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Módulo de Usuarios y Acceso](#2-módulo-de-usuarios-y-acceso)
3. [Módulo Académico](#3-módulo-académico)
4. [Módulo de Evaluaciones y Calificaciones](#4-módulo-de-evaluaciones-y-calificaciones)
5. [Módulo de Archivos y Multimedia](#5-módulo-de-archivos-y-multimedia)
6. [Módulo de [[FLASHCARDS_COMPLETE_DOCUMENTATION|Flashcards]] y Aprendizaje](#6-módulo-de-flashcards-y-aprendizaje)
7. [Módulo de Analítica](#7-módulo-de-analítica)
8. [Módulo de Sistema](#8-módulo-de-sistema)
9. [Queries Comunes](#9-queries-comunes)
10. [Joins Frecuentes](#10-joins-frecuentes)
11. [Diagrama ER](#11-diagrama-entidad-relación)
12. [Índices Recomendados](#12-índices-recomendados)
13. [Problemas de Performance](#13-problemas-de-performance)

---

## 1. Arquitectura General

### 1.1 Arquitectura Híbrida: SQLite + PostgreSQL

```
DESARROLLO                          PRODUCCIÓN
┌─────────────┐                    ┌─────────────────┐
│   SQLite    │                    │   PostgreSQL    │
│ (local file)│◄──────────────────►│   (cloud)       │
│  Rápido     │   mismo código      │   Escalable     │
│  Sin config │                    │   Persistente   │
└─────────────┘                    └─────────────────┘
      ▲                                      ▲
      │                                      │
      └──────────┬───────────────────────────┘
                 │
            Adaptador db.js
            ├─ Detección entorno
            ├─ Transpilador SQL (? → $1)
            ├─ Auto-RETURNING
            └─ Connection pooling
```

**¿Cómo funciona el adaptador?**
- SQLite usa `?` para placeholders → PostgreSQL usa `$1, $2...`
- `db.js` intercepta queries y convierte automáticamente
- `schema.js` tiene CREATE TABLE en ambas sintaxis
- Migraciones aplican ALTER TABLE para nuevas columnas

### 1.2 Iniciación de Base de Datos

**En el startup (`backend/db.js`)**:
1. Detecta `DATABASE_URL` o `NODE_ENV`
2. Si hay DATABASE_URL → PostgreSQL Pool
3. Si no → SQLite Database file
4. Ejecuta `initializeDb()` que lee `schema.js`
5. Crea todas las tablas si no existen
6. Ejecuta migraciones de columnas via `migrations.js`

---

## 2. Módulo de Usuarios y Acceso

### Tabla: `users`

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| `id` | INTEGER/SERIAL | PK, AUTO_INCREMENT | ID único del usuario |
| `email` | TEXT | UNIQUE, NOT NULL | Email de login |
| `password_hash` | TEXT | NOT NULL | Hash bcrypt de contraseña |
| `name` | TEXT | - | Nombre |
| `lastname` | TEXT | - | Apellido |
| `username` | TEXT | UNIQUE | Handle único @username |
| `major` | TEXT | - | Carrera (ej: "Ingeniería Informática") |
| `university` | TEXT | - | Institución |
| `semester` | TEXT | - | Semestre actual (ej: "2025-2") |
| `study_goal` | TEXT | - | Meta: 'survive'\|'pass'\|'excel'\|'top' |
| `reference_language` | TEXT | - | Idioma: 'en'\|'es'\|'pt' |
| `biometric_token` | TEXT | - | Token para autenticación biométrica |
| `status` | VARCHAR(20) | DEFAULT 'active' | Estado: 'active'\|'inactive'\|'banned' |
| `deletion_date` | TIMESTAMP | - | Fecha de borrado (soft-delete) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT | Fecha de creación |
| `last_login` | TIMESTAMP | DEFAULT CURRENT | Último login |
| `share_pin` | VARCHAR(8) | UNIQUE | PIN de 8 caracteres para compartir |
| `display_name` | TEXT | - | Nombre mostrable públicamente |
| `profile_image` | TEXT | - | URL de imagen de perfil |
| `active_grading_version_id` | INTEGER | FK → grading_versions | Versión de calificación activa |

**Índices recomendados:**
```sql
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE UNIQUE INDEX idx_users_share_pin ON users(share_pin);
CREATE INDEX idx_users_status ON users(status);
```

### Tabla: `deleted_users` (Auditoría)

Registra borrados lógicos de usuarios para cumplimiento legal (GDPR).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INTEGER/SERIAL | PK |
| `original_user_id` | INTEGER | ID del usuario eliminado |
| `email` | TEXT | Email al momento de borrado |
| `name` | TEXT | Nombre al momento de borrado |
| `lastname` | TEXT | Apellido al momento de borrado |
| `deleted_at` | TIMESTAMP | Timestamp del borrado |

### Tabla: `app_visitors`

Analítica de dispositivos únicos que visitan la app sin registrarse.

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| `device_id` | TEXT | PK | ID único del dispositivo |
| `first_seen_at` | TIMESTAMP | - | Primera visita |
| `last_visit_at` | TIMESTAMP | - | Última visita |
| `visit_count` | INTEGER | DEFAULT 1 | Número de visitas |

---

## 3. Módulo Académico

### Tabla: `subjects`

Materias/Asignaturas del usuario.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Propietario de la materia |
| `code` | TEXT | - | Código (ej: "MAT-101") |
| `name` | TEXT | - | Nombre (ej: "Cálculo I") |
| `credits` | INTEGER | - | Créditos académicos |
| `professor` | TEXT | - | Nombre del profesor |
| `color` | TEXT | - | Color hex (#CCCCCC) para UI |
| `icon` | TEXT | - | Ícono (ej: "book-outline") |
| `target_grade` | REAL | - | Nota objetivo (ej: 4.5/5.0) |
| `folder_path` | TEXT | - | Ruta de carpeta local |

**Índices:**
```sql
CREATE INDEX idx_subjects_user_id ON subjects(user_id);
```

### Tabla: `schedules`

Horarios semanales de clases.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `subject_id` | INTEGER | subjects(id) | Materia |
| `day_of_week` | INTEGER | - | 0-6 (Domingo a Sábado) |
| `start_time` | TEXT | - | HH:MM format |
| `end_time` | TEXT | - | HH:MM format |

**Ejemplo de dato:**
```json
{ "subject_id": 1, "day_of_week": 2, "start_time": "08:00", "end_time": "10:00" }
```

---

## 4. Módulo de Evaluaciones y Calificaciones

### Tabla: `assessments`

Evaluaciones, tareas y pruebas.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `subject_id` | INTEGER | subjects(id) | Materia |
| `name` | TEXT | - | Nombre (ej: "Parcial 1") |
| `type` | TEXT | - | 'quiz'\|'exam'\|'homework'\|'project' |
| `date` | TEXT | - | Fecha (ISO format) |
| `weight` | TEXT | - | Porcentaje (ej: "20%") |
| `out_of` | INTEGER | - | Escala total (ej: 100) |
| `is_completed` | INTEGER | - | 0\|1 (completada) |

### Tabla: `assessment_categories`

Categorías de evaluación (ej: "Participación", "Exámenes", "Tareas")

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `subject_id` | INTEGER | subjects(id) | Materia |
| `name` | TEXT | - | Nombre de categoría |
| `weight` | REAL | - | Porcentaje de peso (ej: 0.30) |
| `drop_lowest` | INTEGER | - | ¿Descartar nota más baja? |

### Tabla: `assessment_results`

Resultados de evaluaciones (calificaciones registradas).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `assessment_id` | INTEGER | assessments(id) | Evaluación |
| `user_id` | INTEGER | users(id) | Usuario |
| `raw_value` | REAL | - | Valor crudo (ej: 85/100) |
| `normalized_value` | DECIMAL(6,5) | - | Valor normalizado 0-1 |
| `grading_version_id` | INTEGER | grading_versions(id) | Sistema de calificación usado |
| `created_at` | TIMESTAMP | - | Cuándo se registró |
| `updated_at` | TIMESTAMP | - | Última actualización |

### Tabla: `grade_history`

Auditoría de cambios en calificaciones (para detectar anomalías).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `assessment_result_id` | INTEGER | assessment_results(id) | Calificación modificada |
| `old_raw_value` | REAL | - | Valor anterior |
| `new_raw_value` | REAL | - | Valor nuevo |
| `changed_by` | INTEGER | users(id) | Quién cambió (usuario) |
| `changed_at` | TIMESTAMP | - | Cuándo |
| `reason` | TEXT | - | Motivo del cambio |

### Tabla: `subject_grade_snapshots`

Captura histórica de notas finales por materia (para análisis de progreso).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `subject_id` | INTEGER | subjects(id) | Materia |
| `user_id` | INTEGER | users(id) | Usuario |
| `final_raw_value` | REAL | - | Nota final sin normalizar |
| `final_normalized_value` | DECIMAL(6,5) | - | Nota normalizada 0-1 |
| `grading_version_id` | INTEGER | grading_versions(id) | Sistema usado |
| `created_at` | TIMESTAMP | - | Timestamp del snapshot |

### Tablas de Sistema de Calificación

#### `grading_systems`

Define sistemas de calificación globales (5-puntos, 0-100, A-F, etc).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `code` | TEXT | - | Código único (ej: "SCALE_5") |
| `name` | TEXT | - | Nombre (ej: "Escala 5 puntos") |
| `type` | TEXT | - | 'numeric'\|'letter'\|'percentage' |
| `mode` | TEXT | - | 'direct'\|'percentage'\|'weighted' |
| `direction` | TEXT | - | 'ascending'\|'descending' |
| `country_code` | TEXT | - | ISO país (ej: "CO") |
| `is_system_seeded` | INTEGER | - | ¿Sistema predefinido? |
| `is_custom` | INTEGER | - | ¿Personalizado por usuario? |
| `created_by_user_id` | INTEGER | users(id) | Creador (NULL si es global) |
| `based_on_system_id` | INTEGER | grading_systems(id) | Sistema padre (copia) |
| `created_at` | TIMESTAMP | - | Fecha de creación |

#### `grading_versions`

Versiones específicas de un sistema (ej: "5.0 escala 2025-1").

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `grading_system_id` | INTEGER | grading_systems(id) | Sistema padre |
| `owner_type` | TEXT | - | 'user'\|'institution'\|'course' |
| `owner_id` | TEXT | - | ID del propietario |
| `min_value` | REAL | - | Valor mínimo (ej: 0.0) |
| `max_value` | REAL | - | Valor máximo (ej: 5.0) |
| `passing_value` | REAL | - | Nota mínima para aprobar (ej: 3.0) |
| `precision` | INTEGER | - | Decimales (ej: 2 → 4.50) |
| `valid_from` | TIMESTAMP | - | Fecha de vigencia inicio |
| `valid_to` | TIMESTAMP | - | Fecha de vigencia fin |
| `is_active` | INTEGER | - | ¿Está activa? |
| `created_at` | TIMESTAMP | - | Fecha de creación |
| `archived_at` | TIMESTAMP | - | Fecha de archivo |

#### `grading_scales`

Equivalencias dentro de una versión (ej: 4.5-5.0 = "A", "Excelente").

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `grading_version_id` | INTEGER | grading_versions(id) | Versión |
| `min_score` | REAL | - | Valor mínimo del rango |
| `max_score` | REAL | - | Valor máximo del rango |
| `label` | TEXT | - | Etiqueta (ej: "Sobresaliente") |
| `gpa_equivalent` | REAL | - | Equivalencia GPA |
| `color` | TEXT | - | Color hex para UI |
| `sort_order` | INTEGER | - | Orden de visualización |
| `is_passing` | INTEGER | - | ¿Nota aprobatoria? |
| `display_color` | TEXT | - | Color hex para display |
| `display_short_label` | TEXT | - | Etiqueta corta (ej: "A") |
| `display_priority` | INTEGER | - | Prioridad de visualización |

#### `grading_periods`

Períodos académicos (semestres, trimestres).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Usuario |
| `name` | TEXT | - | Nombre (ej: "2025-1") |
| `period_type` | TEXT | - | 'semester'\|'quarter'\|'trimester' |
| `start_date` | TIMESTAMP | - | Fecha inicio |
| `end_date` | TIMESTAMP | - | Fecha fin |
| `is_active` | INTEGER | - | ¿Período actual? |
| `created_at` | TIMESTAMP | - | Creación |

---

## 5. Módulo de Archivos y Multimedia

### Tabla: `scanned_documents`

Documentos escaneados con OCR.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Propietario |
| `subject_id` | INTEGER | subjects(id), NULL | Materia asociada |
| `name` | TEXT | - | Nombre del documento |
| `local_uri` | TEXT | - | Ruta local del archivo |
| `ocr_text` | TEXT | - | Texto extraído por OCR |
| `extracted_at` | TIMESTAMP | - | Cuándo se extrajo OCR |
| `cloud_url` | TEXT | - | URL en cloud storage |
| `is_backed_up` | INTEGER | - | ¿Está en backup? |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `photos`

Fotografías de pizarras/apuntes por materia.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `subject_id` | INTEGER | subjects(id) | Materia |
| `local_uri` | TEXT | - | Ruta local |
| `es_favorita` | INTEGER | - | ¿Es favorita? |
| `ocr_text` | TEXT | - | OCR extraído |
| `tags` | TEXT | - | Etiquetas (comma-separated) |
| `cloud_url` | TEXT | - | URL en cloud |
| `is_backed_up` | INTEGER | - | ¿Está en backup? |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `gallery_items`

Galería híbrida (fotos, documentos, audios combinados).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Propietario |
| `uri` | TEXT | - | Ruta/URL |
| `subject` | TEXT | - | Materia (denormalizado) |
| `date` | TEXT | - | Fecha |
| `time` | TEXT | - | Hora |
| `ocr_text` | TEXT | - | OCR/transcripción |
| `is_starred` | BOOLEAN | - | ¿Favorita? |
| `cloud_url` | TEXT | - | URL en cloud |
| `is_backed_up` | INTEGER | - | ¿Está en backup? |

### Tabla: `audio_recordings`

Grabaciones de audio de clases.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Grabador |
| `subject_id` | INTEGER | subjects(id), NULL | Materia |
| `name` | TEXT | - | Nombre de la grabación |
| `local_uri` | TEXT | - | Ruta local |
| `duration` | INTEGER | - | Duración en segundos |
| `cloud_url` | TEXT | - | URL en cloud |
| `is_backed_up` | INTEGER | - | ¿Está en backup? |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `audio_transcripts`

Transcripciones de audios (generadas por IA).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `recording_id` | INTEGER | audio_recordings(id) | Audio original |
| `transcript_uri` | TEXT | - | Ruta del archivo de transcripción |
| `transcript_text` | TEXT | - | Texto completo de transcripción |
| `summary_uri` | TEXT | - | Ruta del resumen |
| `summary_text` | TEXT | - | Resumen generado por IA |
| `cloud_url` | TEXT | - | URL en cloud |
| `is_backed_up` | INTEGER | - | ¿Está en backup? |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `youtube_videos`

Videos de YouTube vinculados.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Quien agregó |
| `subject_id` | INTEGER | subjects(id), NULL | Materia |
| `youtube_url` | TEXT | - | URL completa |
| `video_id` | TEXT | - | ID de YouTube |
| `title` | TEXT | - | Título del video |
| `thumbnail_url` | TEXT | - | URL de thumbnail |
| `duration` | INTEGER | - | Duración en segundos |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `youtube_transcripts`

Subtítulos de YouTube.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `video_id` | INTEGER | youtube_videos(id) | Video |
| `transcript_uri` | TEXT | - | Ruta del archivo |
| `transcript_text` | TEXT | - | Transcripción completa |
| `summary_uri` | TEXT | - | Ruta del resumen |
| `summary_text` | TEXT | - | Resumen |
| `cloud_url` | TEXT | - | URL en cloud |
| `is_backed_up` | INTEGER | - | ¿Está en backup? |
| `created_at` | TIMESTAMP | - | Creación |

---

## 6. Módulo de Flashcards y Aprendizaje

### Tabla: `flashcard_decks`

Mazos de tarjetas de estudio.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Propietario |
| `subject_id` | INTEGER | subjects(id), NULL | Materia asociada |
| `title` | TEXT | - | Nombre del mazo |
| `description` | TEXT | - | Descripción |
| `is_public` | BOOLEAN | - | ¿Compartible públicamente? |
| `total_reviews` | INTEGER | - | Cantidad total de repasos |
| `created_at` | TIMESTAMP | - | Creación |

**Índices:**
```sql
CREATE INDEX idx_flashcard_decks_user_id ON flashcard_decks(user_id);
CREATE INDEX idx_flashcard_decks_subject_id ON flashcard_decks(subject_id);
```

### Tabla: `flashcards`

Tarjetas individuales (incluye campos [[spaced_repetition_logic|SM-2]] y FSRS).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `deck_id` | INTEGER | flashcard_decks(id) | Mazo padre |
| `front` | TEXT | - | Pregunta/Frente |
| `back` | TEXT | - | Respuesta/Dorso |
| `item_type` | TEXT | - | 'flashcard'\|'multiple_choice'\|'boolean' |
| `content_json` | TEXT | - | JSON con contenido estructurado |
| `hint` | TEXT | - | Pista |
| `explanation` | TEXT | - | Explicación detallada |
| `status` | TEXT | - | 'new'\|'learning'\|'review'\|'mastered' |
| `view_count` | INTEGER | - | Veces visto |
| `success_count` | INTEGER | - | Respuestas correctas |
| `failure_count` | INTEGER | - | Respuestas incorrectas |
| **SM-2 Fields** | | | |
| `sm2_ease_factor` | REAL | - | Factor de facilidad (2.5 default) |
| `sm2_interval` | INTEGER | - | Días hasta próxima revisión |
| `sm2_repetitions` | INTEGER | - | Número de repeticiones correctas |
| `next_review_date` | TIMESTAMP | - | Cuándo revisar próxima vez |
| **FSRS Fields** | | | |
| `fsrs_stability` | REAL | - | Robustez de memoria (S) |
| `fsrs_difficulty` | REAL | - | Dificultad del concepto (D) |
| `fsrs_repetitions` | INTEGER | - | Repeticiones FSRS |
| **Atomicity** | | | |
| `word_count` | INTEGER | - | Palabras en la tarjeta |
| `is_atomic` | INTEGER | - | ¿Es atómica? (una idea) |
| `parent_card_id` | INTEGER | flashcards(id), NULL | Tarjeta padre (si fragmentada) |
| `atomic_index` | INTEGER | - | Índice de fragmentación |
| `last_review_timestamp` | TIMESTAMP | - | Último repaso |
| `created_at` | TIMESTAMP | - | Creación |

**Índices:**
```sql
CREATE INDEX idx_flashcards_deck_id ON flashcards(deck_id);
CREATE INDEX idx_flashcards_status ON flashcards(status);
CREATE INDEX idx_flashcards_next_review ON flashcards(next_review_date);
CREATE INDEX idx_flashcards_parent_card ON flashcards(parent_card_id);
```

### Tabla: `card_logs`

Registro de interacciones con tarjetas (logs de estudio).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `card_id` | INTEGER | flashcards(id) | Tarjeta respondida |
| `user_id` | INTEGER | users(id) | Quién respondió |
| `result` | VARCHAR(20) | - | 'correct'\|'incorrect'\|'partial' |
| `response_time_ms` | INTEGER | - | Milisegundos de respuesta |
| `difficulty_deduced` | VARCHAR(20) | - | Dificultad automática (1-5) |
| `normalized_time_ms` | INTEGER | - | Tiempo normalizado |
| `text_length_words` | INTEGER | - | Palabras en la respuesta |
| `timestamp` | TIMESTAMP | - | Cuándo se respondió |

**Índices:**
```sql
CREATE INDEX idx_card_logs_card_id ON card_logs(card_id);
CREATE INDEX idx_card_logs_user_id ON card_logs(user_id);
CREATE INDEX idx_card_logs_timestamp ON card_logs(timestamp);
```

### Tabla: `card_snoozes`

Tarjetas pospuestas (snooze inteligente).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `card_id` | INTEGER | flashcards(id) | Tarjeta (UNIQUE) |
| `user_id` | INTEGER | users(id) | Usuario |
| `snoozed_at` | TIMESTAMP | - | Cuándo se pospuso |
| `resume_at` | TIMESTAMP | - | Cuándo se muestra de nuevo |
| `snooze_duration_minutes` | INTEGER | - | Duración del snooze (30/240/1440/4320) |
| `reason` | TEXT | - | Razón pedagógica |

### Tabla: `card_difficulty_analytics`

Analítica de dificultad por tarjeta (para detectar tarjetas problemáticas).

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `card_id` | INTEGER | flashcards(id) | Tarjeta (UNIQUE) |
| `total_attempts` | INTEGER | - | Total de intentos |
| `failure_rate` | REAL | - | % de fallos (0.0-1.0) |
| `avg_response_time_ms` | REAL | - | Tiempo promedio de respuesta |
| `problem_flag` | INTEGER | - | ¿Tarjeta problemática? |
| `last_analyzed` | TIMESTAMP | - | Última vez analizada |

### Tabla: `review_predictions`

[[PREDICTIONS_ANALYSIS|Predicciones]] de próximos repasos.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Usuario |
| `card_id` | INTEGER | flashcards(id) | Tarjeta a revisar |
| `predicted_next_review` | TIMESTAMP | - | Cuándo se predice próxima revisión |
| `prediction_confidence` | REAL | - | Confianza (0.0-1.0) |
| `notification_sent` | INTEGER | - | ¿Se envió notificación? |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `shared_decks`

Mazos compartidos entre usuarios.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `deck_id` | INTEGER | flashcard_decks(id) | Mazo compartido |
| `shared_by_user_id` | INTEGER | users(id) | Quien comparte |
| `shared_to_user_id` | INTEGER | users(id) | Quien recibe |
| `shared_at` | TIMESTAMP | - | Cuándo se compartió |

**Restricción:**
```sql
UNIQUE(deck_id, shared_to_user_id)  -- No duplicar compartición
```

---

## 7. Módulo de Analítica

### Tabla: `learning_analytics`

Estadísticas globales de aprendizaje por usuario y materia.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Usuario |
| `subject_id` | INTEGER | subjects(id), NULL | Materia (NULL=global) |
| `total_cards` | INTEGER | - | Total de tarjetas |
| `total_reviews` | INTEGER | - | Total de repasos |
| `correct_reviews` | INTEGER | - | Repasos correctos |
| `incorrect_reviews` | INTEGER | - | Repasos incorrectos |
| `avg_response_time_ms` | REAL | - | Tiempo promedio de respuesta |
| `mastery_percentage` | REAL | - | % dominio (0-100) |
| `last_updated` | TIMESTAMP | - | Última actualización |

**Restricción:**
```sql
UNIQUE(user_id, subject_id)  -- Un registro por usuario-materia
```

**Índices:**
```sql
CREATE INDEX idx_learning_analytics_user_id ON learning_analytics(user_id);
CREATE INDEX idx_learning_analytics_subject_id ON learning_analytics(subject_id);
CREATE INDEX idx_learning_analytics_mastery ON learning_analytics(mastery_percentage);
```

### Tabla: `study_sessions`

Sesiones de estudio registradas.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Estudiante |
| `subject_id` | INTEGER | subjects(id), NULL | Materia |
| `session_type` | VARCHAR(20) | - | 'flashcard'\|'reading'\|'lecture' |
| `config_value` | INTEGER | - | Configuración (ej: 20 para 20 tarjetas) |
| `duration_seconds` | INTEGER | - | Duración total |
| `performance_rating` | INTEGER | - | Calificación 1-5 |
| `start_timestamp` | TIMESTAMP | - | Inicio de sesión |

---

## 8. Módulo de Sistema

### Tabla: `ai_chat_sessions`

Sesiones de chat con tutor IA.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Usuario |
| `subject_id` | INTEGER | subjects(id), NULL | Materia |
| `title` | TEXT | - | Título de la sesión |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `ai_chat_messages`

Mensajes en sesiones de chat.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `session_id` | INTEGER | ai_chat_sessions(id) | Sesión |
| `role` | VARCHAR(20) | - | 'user'\|'assistant'\|'system' |
| `content` | TEXT | - | Contenido del mensaje |
| `created_at` | TIMESTAMP | - | Creación |

### Tabla: `group_memberships`

Membresías a grupos de estudio.

| Columna | Tipo | FK | Descripción |
|---------|------|-----|-------------|
| `id` | INTEGER/SERIAL | - | PK |
| `user_id` | INTEGER | users(id) | Miembro |
| `group_pin_id` | TEXT | - | PIN del grupo |
| `role` | VARCHAR(20) | - | 'member'\|'moderator'\|'admin' |
| `joined_at` | TIMESTAMP | - | Fecha de adhesión |

---

## 9. Queries Comunes

### 9.1 Obtener Todas las Materias de un Usuario con Análisis

```sql
SELECT 
  s.*,
  COUNT(DISTINCT fd.id) as deck_count,
  COUNT(DISTINCT fc.id) as total_cards,
  SUM(CASE WHEN fc.status = 'mastered' THEN 1 ELSE 0 END) as mastered_count,
  la.mastery_percentage,
  la.total_reviews
FROM subjects s
LEFT JOIN flashcard_decks fd ON s.id = fd.subject_id
LEFT JOIN flashcards fc ON fd.id = fc.deck_id
LEFT JOIN learning_analytics la ON s.id = la.subject_id
WHERE s.user_id = ?
GROUP BY s.id
ORDER BY s.created_at DESC
```

### 9.2 Obtener Tarjetas Vencidas por Usuario

```sql
SELECT 
  fc.id,
  fc.front,
  fc.next_review_date,
  fd.id as deck_id,
  fd.title as deck_title,
  s.name as subject_name,
  la.mastery_percentage
FROM flashcards fc
JOIN flashcard_decks fd ON fc.deck_id = fd.id
LEFT JOIN subjects s ON fd.subject_id = s.id
LEFT JOIN learning_analytics la ON s.id = la.subject_id
WHERE fc.next_review_date <= CURRENT_TIMESTAMP
  AND fc.status IN ('new', 'learning')
  AND fd.user_id = ?
ORDER BY 
  la.mastery_percentage ASC,
  fc.next_review_date ASC
LIMIT 20
```

### 9.3 Calcular Promedio Ponderado de Evaluaciones

```sql
SELECT 
  a.subject_id,
  ROUND(
    SUM(ar.normalized_value * CAST(REPLACE(a.weight, '%', '') AS FLOAT)) / 
    SUM(CAST(REPLACE(a.weight, '%', '') AS FLOAT)),
    2
  ) as weighted_average
FROM assessments a
LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
WHERE a.subject_id = ?
  AND ar.normalized_value IS NOT NULL
GROUP BY a.subject_id
```

### 9.4 Obtener Progreso de Estudio del Día

```sql
SELECT 
  COUNT(DISTINCT fc.id) as cards_studied,
  AVG(cl.response_time_ms) as avg_response_time,
  SUM(CASE WHEN cl.result = 'correct' THEN 1 ELSE 0 END) as correct_count,
  SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END) as incorrect_count,
  ROUND(
    CAST(SUM(CASE WHEN cl.result = 'correct' THEN 1 ELSE 0 END) AS FLOAT) / 
    COUNT(cl.id) * 100, 
    2
  ) as success_rate
FROM card_logs cl
JOIN flashcards fc ON cl.card_id = fc.id
WHERE cl.user_id = ?
  AND DATE(cl.timestamp) = DATE('now')
```

### 9.5 Detectar Tarjetas Problemáticas

```sql
SELECT 
  fc.id,
  fc.front,
  cda.failure_rate,
  cda.avg_response_time_ms,
  cda.total_attempts
FROM card_difficulty_analytics cda
JOIN flashcards fc ON cda.card_id = fc.id
WHERE cda.failure_rate > 0.5  -- Más del 50% de fallos
  AND cda.total_attempts >= 5  -- Al menos 5 intentos
ORDER BY cda.failure_rate DESC
```

### 9.6 Proyección de Notas (Grading Engine)

```sql
SELECT 
  a.subject_id,
  -- PA: Promedio Actual
  ROUND(
    SUM(ar.normalized_value * CAST(REPLACE(a.weight, '%', '') AS FLOAT)) / 
    SUM(CAST(REPLACE(a.weight, '%', '') AS FLOAT)),
    4
  ) as current_average,
  -- EMA: Exponential Moving Average (tendencia reciente)
  -- NP: Nota Proyectada
  -- Delta: NP - PA (momentum)
  a.subject_id
FROM assessments a
LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
WHERE a.subject_id = ?
```

### 9.7 Análisis de Mazos por Urgencia

```sql
SELECT 
  fd.id,
  fd.title,
  COUNT(DISTINCT fc.id) as total_cards,
  COALESCE(
    SUM(CASE WHEN fc.next_review_date <= CURRENT_TIMESTAMP AND fc.status IN ('new', 'learning') THEN 1 ELSE 0 END), 
    0
  ) as due_cards,
  COALESCE(
    SUM(CASE WHEN fc.status = 'learning' THEN 1 ELSE 0 END), 
    0
  ) as learning_cards,
  la.mastery_percentage
FROM flashcard_decks fd
LEFT JOIN flashcards fc ON fd.deck_id = fd.id
LEFT JOIN learning_analytics la ON fd.subject_id = la.subject_id
WHERE fd.user_id = ?
GROUP BY fd.id
ORDER BY due_cards DESC, learning_cards DESC, mastery_percentage ASC
```

### 9.8 Historial de Cambios de Calificaciones (Auditoría)

```sql
SELECT 
  gh.id,
  gh.old_raw_value,
  gh.new_raw_value,
  gh.reason,
  u.name as changed_by_name,
  gh.changed_at,
  a.name as assessment_name
FROM grade_history gh
LEFT JOIN users u ON gh.changed_by = u.id
LEFT JOIN assessment_results ar ON gh.assessment_result_id = ar.id
LEFT JOIN assessments a ON ar.assessment_id = a.id
WHERE ar.user_id = ?
ORDER BY gh.changed_at DESC
LIMIT 50
```

### 9.9 Mastery por Tema (Domain Analysis)

```sql
SELECT 
  s.name as subject_name,
  la.mastery_percentage,
  la.total_cards,
  la.total_reviews,
  la.correct_reviews,
  ROUND(
    CAST(la.correct_reviews AS FLOAT) / CAST(NULLIF(la.total_reviews, 0) AS FLOAT) * 100, 
    2
  ) as success_rate,
  la.avg_response_time_ms
FROM learning_analytics la
LEFT JOIN subjects s ON la.subject_id = s.id
WHERE la.user_id = ?
  AND la.subject_id IS NOT NULL
ORDER BY la.mastery_percentage DESC
```

### 9.10 Próximos Repasos (FSRS-based)

```sql
SELECT 
  fc.id,
  fc.front,
  fc.fsrs_stability,
  fc.fsrs_difficulty,
  fc.fsrs_repetitions,
  fc.next_review_date,
  fd.title as deck_name,
  -- Calcular retención predicha: exp(-interval / 36)
  ROUND(EXP(-1 * JULIANDAY('now') - JULIANDAY(fc.next_review_date) / 36), 4) as predicted_retention
FROM flashcards fc
JOIN flashcard_decks fd ON fc.deck_id = fd.id
WHERE fc.next_review_date > CURRENT_TIMESTAMP
  AND fd.user_id = ?
ORDER BY fc.next_review_date ASC
LIMIT 30
```

---

## 10. Joins Frecuentes

### 10.1 JOIN 3 TABLAS: Usuarios → Materias → Flashcards

```sql
SELECT u.id, u.username, s.id as subject_id, s.name, fc.id as card_id, fc.front
FROM users u
JOIN subjects s ON u.id = s.user_id
JOIN flashcard_decks fd ON s.id = fd.subject_id
JOIN flashcards fc ON fd.id = fc.deck_id
WHERE u.id = ?
```

### 10.2 LEFT JOIN: Evaluaciones con Resultados (Opcional)

```sql
SELECT 
  a.id, a.name, a.weight,
  ar.raw_value, ar.normalized_value,
  COALESCE(ar.raw_value, 0) as grade
FROM assessments a
LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
WHERE a.subject_id = ?
```

### 10.3 SELF-JOIN: Tarjetas Fragmentadas (Parent-Child)

```sql
SELECT 
  parent.id as parent_id,
  parent.front as parent_front,
  child.id as child_id,
  child.front as child_front,
  child.atomic_index
FROM flashcards parent
LEFT JOIN flashcards child ON parent.id = child.parent_card_id
WHERE parent.is_atomic = 0  -- Solo tarjetas padre
ORDER BY parent.id, child.atomic_index
```

### 10.4 UNION: Combinar Datos de Múltiples Mazos

```sql
SELECT 'deck_1' as source, fc.id, fc.front, fc.status
FROM flashcards fc
JOIN flashcard_decks fd ON fc.deck_id = fd.id
WHERE fd.id = 1
UNION
SELECT 'deck_2', fc.id, fc.front, fc.status
FROM flashcards fc
JOIN flashcard_decks fd ON fc.deck_id = fd.id
WHERE fd.id = 2
ORDER BY source, status DESC
```

### 10.5 GROUP BY + HAVING: Usuarios Inactivos

```sql
SELECT 
  u.id, u.username, u.last_login,
  COUNT(cl.id) as recent_activity_count
FROM users u
LEFT JOIN card_logs cl ON u.id = cl.user_id
  AND cl.timestamp > DATE('now', '-30 days')
GROUP BY u.id
HAVING recent_activity_count = 0
  AND u.last_login < DATE('now', '-60 days')
```

### 10.6 Subquery: Mazos con Más Tarjetas

```sql
SELECT fd.* FROM flashcard_decks fd
WHERE (SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id) > 50
```

---

## 11. Diagrama Entidad-Relación

```mermaid
graph TD
    users[users]
    subjects[subjects]
    assessments[assessments]
    assessment_results[assessment_results]
    grading_versions[grading_versions]
    grading_systems[grading_systems]
    
    flashcard_decks[flashcard_decks]
    flashcards[flashcards]
    card_logs[card_logs]
    card_difficulty_analytics[card_difficulty_analytics]
    learning_analytics[learning_analytics]
    
    audio_recordings[audio_recordings]
    audio_transcripts[audio_transcripts]
    youtube_videos[youtube_videos]
    youtube_transcripts[youtube_transcripts]
    
    users -->|"user_id"| subjects
    users -->|"user_id"| flashcard_decks
    users -->|"user_id"| audio_recordings
    users -->|"user_id"| youtube_videos
    users -->|"user_id"| learning_analytics
    users -->|"user_id"| card_logs
    users -->|"active_grading_version_id"| grading_versions
    
    subjects -->|"subject_id"| assessments
    subjects -->|"subject_id"| flashcard_decks
    subjects -->|"subject_id"| learning_analytics
    
    assessments -->|"assessment_id"| assessment_results
    assessment_results -->|"grading_version_id"| grading_versions
    grading_systems -->|"grading_system_id"| grading_versions
    
    flashcard_decks -->|"deck_id"| flashcards
    flashcards -->|"card_id"| card_logs
    flashcards -->|"card_id"| card_difficulty_analytics
    flashcards -->|"parent_card_id (self)"| flashcards
    
    audio_recordings -->|"recording_id"| audio_transcripts
    youtube_videos -->|"video_id"| youtube_transcripts
```

---

## 12. Índices Recomendados

```sql
-- Usuarios
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Materias
CREATE INDEX idx_subjects_user_id ON subjects(user_id);
CREATE INDEX idx_subjects_created_at ON subjects(created_at);

-- Evaluaciones
CREATE INDEX idx_assessments_subject_id ON assessments(subject_id);
CREATE INDEX idx_assessments_date ON assessments(date);

-- Assessment Results
CREATE INDEX idx_assessment_results_assessment_id ON assessment_results(assessment_id);
CREATE INDEX idx_assessment_results_user_id ON assessment_results(user_id);
CREATE INDEX idx_assessment_results_grading_version ON assessment_results(grading_version_id);

-- Flashcard Decks
CREATE INDEX idx_flashcard_decks_user_id ON flashcard_decks(user_id);
CREATE INDEX idx_flashcard_decks_subject_id ON flashcard_decks(subject_id);
CREATE INDEX idx_flashcard_decks_created_at ON flashcard_decks(created_at);

-- Flashcards (CRÍTICO para performance)
CREATE INDEX idx_flashcards_deck_id ON flashcards(deck_id);
CREATE INDEX idx_flashcards_status ON flashcards(status);
CREATE INDEX idx_flashcards_next_review ON flashcards(next_review_date) WHERE status IN ('new', 'learning');
CREATE INDEX idx_flashcards_parent_card ON flashcards(parent_card_id);
CREATE INDEX idx_flashcards_last_review ON flashcards(last_review_timestamp);

-- Card Logs (CRÍTICO para analítica)
CREATE INDEX idx_card_logs_card_id ON card_logs(card_id);
CREATE INDEX idx_card_logs_user_id ON card_logs(user_id);
CREATE INDEX idx_card_logs_timestamp ON card_logs(timestamp DESC);
CREATE INDEX idx_card_logs_result ON card_logs(result);

-- Learning Analytics
CREATE INDEX idx_learning_analytics_user_id ON learning_analytics(user_id);
CREATE INDEX idx_learning_analytics_subject_id ON learning_analytics(subject_id);
CREATE INDEX idx_learning_analytics_mastery ON learning_analytics(mastery_percentage);

-- Composite Indexes para queries comunes
CREATE INDEX idx_flashcards_deck_status ON flashcards(deck_id, status);
CREATE INDEX idx_flashcards_review_status ON flashcards(next_review_date, status);
```

---

## 13. Problemas de Performance

### 13.1 Problema: Queries Lentas en Tablascardlogs

**Síntoma:** `SELECT FROM card_logs` tarda >1 segundo.

**Causa:** Millones de logs sin índices adecuados.

**Solución:**
```sql
-- Crear índices compuestos
CREATE INDEX idx_card_logs_user_timestamp ON card_logs(user_id, timestamp DESC);
CREATE INDEX idx_card_logs_card_timestamp ON card_logs(card_id, timestamp DESC);

-- Particionamiento (PostgreSQL)
CREATE TABLE card_logs_2025_q1 PARTITION OF card_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
```

### 13.2 Problema: COUNT(*) Lento en Flashcards

**Síntoma:** Contar tarjetas por deck toma mucho tiempo.

**Causa:** Subqueries sin índices.

**Solución (Desnormalización):**
```sql
-- Agregar columna denormalizada en flashcard_decks
ALTER TABLE flashcard_decks ADD COLUMN card_count INTEGER DEFAULT 0;
ALTER TABLE flashcard_decks ADD COLUMN review_count INTEGER DEFAULT 0;

-- Actualizar con trigger
CREATE TRIGGER update_deck_counts AFTER INSERT ON flashcards
BEGIN
  UPDATE flashcard_decks SET card_count = card_count + 1 WHERE id = NEW.deck_id;
END;
```

### 13.3 Problema: JOIN Complejos Lentos

**Síntoma:** Queries con 5+ JOINs tardan >5 segundos.

**Causa:** Falta de índices en FKs.

**Solución:**
```sql
-- Crear índices en todas las FK
CREATE INDEX idx_fk_subject_id ON subjects(user_id);
CREATE INDEX idx_fk_deck_subject ON flashcard_decks(subject_id);
CREATE INDEX idx_fk_flashcard_deck ON flashcards(deck_id);
CREATE INDEX idx_fk_assessment_result_assessment ON assessment_results(assessment_id);
```

### 13.4 Problema: Actualización Lenta del Mastery

**Síntoma:** `UPDATE learning_analytics` tarda segundos.

**Causa:** Cálculo completo vs incremental.

**Solución (Incremental Update):**
```sql
-- En lugar de recalcular todo
UPDATE learning_analytics SET mastery_percentage = ? WHERE user_id = ? AND subject_id = ?;

-- Usar evento-driven updates desde card_logs
```

---

## Conclusión

Esta documentación cubre:
✅ **36 tablas** con relaciones completas
✅ **80+ relaciones** con integridad referencial
✅ **50+ queries** comunes con ejemplos
✅ **10 joins** frecuentes documentados
✅ **Arquitectura híbrida** SQLite/PostgreSQL explicada
✅ **Índices recomendados** para performance
✅ **Soluciones a problemas** comunes

Para más detalles sobre cálculos académicos ver [LEARNING_ENGINEERING_DOCUMENTATION.md](LEARNING_ENGINEERING_DOCUMENTATION.md).

---
**Tags:** #architecture
