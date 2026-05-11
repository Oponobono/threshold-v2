# Documentación de la Base de Datos - Threshold

## Arquitectura de Persistencia: SQLite y PostgreSQL

Threshold emplea una arquitectura de base de datos **Híbrida Adaptativa**, lo que significa que la misma base de código puede ejecutarse sobre dos motores de base de datos totalmente diferentes de forma transparente:

1. **SQLite (`sqlite3`)**: Utilizado para entornos de desarrollo local. Es rápido, no requiere configuración de servidores y crea el archivo `database.sqlite` en el backend.
2. **PostgreSQL (`pg`)**: Utilizado para el entorno de producción (ej. despliegues en Render o Heroku). 

### ¿Por qué se implementó PostgreSQL?
Inicialmente, Threshold usaba solo SQLite. Sin embargo, en arquitecturas *cloud* sin estado (stateless) o *PaaS* modernas (como Render o Heroku), los contenedores del servidor se reinician constantemente, lo que provocaría la pérdida del archivo `database.sqlite` en cada reinicio. PostgreSQL garantiza la **persistencia en la nube, escalabilidad para múltiples usuarios concurrentes**, y previene bloqueos de escritura (database locked) que son comunes en SQLite.

### ¿Cómo funciona la relación / conexión (`db.js`)?
La capa de conexión se encuentra en el archivo `backend/db.js`. Funciona como un adaptador (Wrapper):
- **Detección Dinámica:** Si detecta la variable de entorno `DATABASE_URL` (o `NODE_ENV=production`), asume que está en producción e instancia un `Pool` de conexiones PostgreSQL. Si no, instancia un `Database` de SQLite.
- **Transpilador SQL en Tiempo de Ejecución:** Para no reescribir todos los controladores, el adaptador intercepta las consultas creadas para SQLite e internamente convierte los parámetros `?` a la sintaxis de PostgreSQL (`$1, $2...`). Además, a las consultas `INSERT` les anexa `RETURNING id` para poder recuperar el `lastID` de forma idéntica a como lo haría SQLite.
- **Migraciones Centralizadas:** Al arrancar el servidor, `db.js` llama a `initializeDb()` el cual lee el archivo `schema.js`. Ese archivo contiene dos versiones de cada `CREATE TABLE` (una para SQLite y otra para PostgreSQL) y ejecuta la que corresponda al entorno actual.

A continuación se documenta el esquema completo, incluyendo las sentencias SQL exactas de creación para ambos motores, llaves primarias, foráneas, restricciones y relaciones.

---

## 1. Módulo de Usuarios y Acceso

### `users`
Almacena la información de la cuenta, configuraciones académicas y credenciales de acceso.
- **Relaciones:** Tabla padre de la que dependen todas las demás entidades del usuario.

**SQLite:**
```sql
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
  semester TEXT,              -- Período académico actual (ej: "2025-2 · 5to semestre"). Usado por analítica Big Data para comparar progreso entre semestres.
  study_goal TEXT,            -- Objetivo principal del usuario: 'survive' | 'pass' | 'excel' | 'top'. Permite a la IA de Groq personalizar mensajes del Umbral.
  reference_language TEXT,    -- Idioma de referencia (ej: 'en', 'es', 'pt'). Prioriza tecnicismos bilingües en flashcards generadas por IA.
  biometric_token TEXT,
  status VARCHAR(20) DEFAULT 'active',
  deletion_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
  share_pin VARCHAR(8) UNIQUE,
  display_name TEXT
)
```

**PostgreSQL:**
```sql
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
  semester TEXT,              -- Período académico actual. Usado por analítica Big Data para comparar progreso entre semestres.
  study_goal TEXT,            -- Objetivo del usuario: 'survive' | 'pass' | 'excel' | 'top'. Personaliza mensajes IA Groq.
  reference_language TEXT,    -- Idioma de referencia (ej: 'en', 'es'). Prioriza tecnicismos bilingües en flashcards.
  biometric_token TEXT,
  status VARCHAR(20) DEFAULT 'active',
  deletion_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  share_pin VARCHAR(8) UNIQUE,
  display_name TEXT
)
```

### `deleted_users`
Tabla de auditoría para registro de borrado lógico (soft-delete).

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS deleted_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_user_id INTEGER,
  email TEXT,
  name TEXT,
  lastname TEXT,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS deleted_users (
  id SERIAL PRIMARY KEY,
  original_user_id INTEGER,
  email TEXT,
  name TEXT,
  lastname TEXT,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `app_visitors`
Registro analítico de dispositivos.

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS app_visitors (
  device_id TEXT PRIMARY KEY,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_visit_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  visit_count INTEGER DEFAULT 1
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS app_visitors (
  device_id TEXT PRIMARY KEY,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_visit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  visit_count INTEGER DEFAULT 1
)
```

---

## 2. Módulo Académico

### `subjects`
Materias/Asignaturas del usuario.
- **FKs:** `user_id` -> `users(id)`

**SQLite:**
```sql
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
```

**PostgreSQL:**
```sql
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
```

### `schedules`
Horarios de clases semanales para el calendario.
- **FKs:** `subject_id` -> `subjects(id)`

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
)
```

### `assessments`
Evaluaciones y tareas.
- **FKs:** `subject_id` -> `subjects(id)`

**SQLite:**
```sql
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
```

**PostgreSQL:**
```sql
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
```

---

## 3. Módulo de Archivos y Escaneos

### `scanned_documents`
Documentos analizados mediante OCR.
- **FKs:** `user_id` -> `users(id)`, `subject_id` -> `subjects(id)` (ON DELETE SET NULL)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS scanned_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject_id INTEGER,
  name TEXT,
  local_uri TEXT NOT NULL,
  ocr_text TEXT,
  extracted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS scanned_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  name TEXT,
  local_uri TEXT NOT NULL,
  ocr_text TEXT,
  extracted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `photos`
Fotografías tomadas dentro de una materia.
- **FKs:** `subject_id` -> `subjects(id)` (ON DELETE CASCADE)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL,
  local_uri TEXT NOT NULL,
  es_favorita INTEGER DEFAULT 0,
  ocr_text TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  local_uri TEXT NOT NULL,
  es_favorita INTEGER DEFAULT 0,
  ocr_text TEXT,
  tags TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `gallery_items`
Ítems de la galería híbrida.
- **FKs:** `user_id` -> `users(id)`

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS gallery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  uri TEXT NOT NULL,
  subject TEXT,
  date TEXT,
  time TEXT,
  ocr_text TEXT,
  is_starred BOOLEAN DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS gallery_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  uri TEXT NOT NULL,
  subject TEXT,
  date TEXT,
  time TEXT,
  ocr_text TEXT,
  is_starred BOOLEAN DEFAULT false
)
```

---

## 4. Módulo Multimedia y Transcripciones

### `audio_recordings`
Grabaciones de voz de clases.
- **FKs:** `user_id` -> `users(id)`, `subject_id` -> `subjects(id)` (ON DELETE SET NULL)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS audio_recordings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject_id INTEGER,
  name TEXT,
  local_uri TEXT NOT NULL,
  duration INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS audio_recordings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  name TEXT,
  local_uri TEXT NOT NULL,
  duration INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `audio_transcripts`
Transcripciones generadas de los audios.
- **FKs:** `recording_id` -> `audio_recordings(id)` (ON DELETE CASCADE)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS audio_transcripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recording_id INTEGER NOT NULL,
  transcript_uri TEXT,
  transcript_text TEXT,
  summary_uri TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recording_id) REFERENCES audio_recordings(id) ON DELETE CASCADE
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS audio_transcripts (
  id SERIAL PRIMARY KEY,
  recording_id INTEGER NOT NULL REFERENCES audio_recordings(id) ON DELETE CASCADE,
  transcript_uri TEXT,
  transcript_text TEXT,
  summary_uri TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `youtube_videos`
Enlaces y metadata de videos de YouTube vinculados.
- **FKs:** `user_id` -> `users(id)`, `subject_id` -> `subjects(id)` (ON DELETE SET NULL)

**SQLite:**
```sql
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
```

**PostgreSQL:**
```sql
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
```

### `youtube_transcripts`
Subtítulos/Transcripciones de YouTube.
- **FKs:** `video_id` -> `youtube_videos(id)` (ON DELETE CASCADE)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS youtube_transcripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  transcript_uri TEXT,
  transcript_text TEXT,
  summary_uri TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES youtube_videos(id) ON DELETE CASCADE
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS youtube_transcripts (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE,
  transcript_uri TEXT,
  transcript_text TEXT,
  summary_uri TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

## 5. Módulo de Flashcards y Repaso

### `flashcard_decks`
Mazos de tarjetas de estudio.
- **FKs:** `user_id` -> `users(id)`, `subject_id` -> `subjects(id)` (ON DELETE CASCADE)

**SQLite:**
```sql
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
```

**PostgreSQL:**
```sql
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
```

### `flashcards`
Tarjetas individuales dentro de un mazo.
- **FKs:** `deck_id` -> `flashcard_decks(id)` (ON DELETE CASCADE)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS flashcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  view_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_review_timestamp DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS flashcards (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  view_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_review_timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `card_logs`
Registro de uso de cada flashcard (para el algoritmo SRS).
- **FKs:** `card_id` -> `flashcards(id)` (ON DELETE CASCADE), `user_id` -> `users(id)`

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS card_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  result VARCHAR(20),
  response_time_ms INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS card_logs (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  result VARCHAR(20),
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `shared_decks`
Mazos compartidos entre usuarios de la comunidad.
- **FKs:** `deck_id`, `shared_by_user_id`, `shared_to_user_id`

**SQLite:**
```sql
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
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS shared_decks (
  id SERIAL PRIMARY KEY,
  deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  shared_by_user_id INTEGER NOT NULL REFERENCES users(id),
  shared_to_user_id INTEGER NOT NULL REFERENCES users(id),
  shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(deck_id, shared_to_user_id)
)
```

---

## 6. Módulo de IA y Productividad

### `ai_chat_sessions`
Sesiones de chat del tutor IA.
- **FKs:** `user_id` -> `users(id)`, `subject_id` -> `subjects(id)` (ON DELETE CASCADE)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject_id INTEGER,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `ai_chat_messages`
Mensajes por sesión (historial de memoria IA).
- **FKs:** `session_id` -> `ai_chat_sessions(id)` (ON DELETE CASCADE)

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### `study_sessions`
Tiempos de estudio (Pomodoro, Flow).
- **FKs:** `user_id` -> `users(id)`, `subject_id` -> `subjects(id)`

**SQLite:**
```sql
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
```

**PostgreSQL:**
```sql
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
```

### `group_memberships`
Manejo de grupos de estudio / PIN compartido.
- **FKs:** `user_id` -> `users(id)`

**SQLite:**
```sql
CREATE TABLE IF NOT EXISTS group_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  group_pin_id TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

**PostgreSQL:**
```sql
CREATE TABLE IF NOT EXISTS group_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  group_pin_id TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---
*Documento generado por el motor de migraciones centralizado (`schema.js`).*
