const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const tableSchema = require('./schema');
const { migrateColumnsPostgres } = require('./migrations');
const { seedGradingSystemsPostgres } = require('./seeders');
const { fixIsActiveBooleanToInteger } = require('./migrations/fix-is-active-type');
const { fixUserIdTypes } = require('./migrations/fix-user-id-type');
const { fixIdTypes } = require('./migrations/fix-id-type');
const { fixSubjectIdTypes } = require('./migrations/fix-subject-id-type');

const initializePostgresDb = async (pool) => {
  // ── Validar conexión antes de cualquier DDL ──────────────
  // Si el pool no puede conectarse (IPv6, DNS, credenciales),
  // el servidor DEBE fallar — no tiene sentido operar sin DB.
  try {
    // Usamos Promise.race para forzar un timeout explícito, ya que a veces
    // a nivel de OS (DNS o firewall TCP Drop) el cuelgue no respeta el connectionTimeoutMillis
    const connectPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT: No se pudo establecer conexión TCP con Supabase en 15s. (¿DATABASE_URL incorrecta o usando db.xxx en lugar de pooler.xxx?)')), 15000)
    );
    
    const client = await Promise.race([connectPromise, timeoutPromise]);
    await client.query('SELECT 1 AS connection_ok');
    client.release();
    console.log('✓ Conexión PostgreSQL verificada (SELECT 1 ok).');
  } catch (connErr) {
    console.error('❌ No se puede conectar a PostgreSQL:', connErr.message);
    console.error('   Verifica que tu DATABASE_URL usa "pooler.supabase.com" (IPv4) y NO "db.xxx.supabase.co" (IPv6 only).');
    process.exit(1); // Forzar salida inmediata en lugar de quedarse colgado
  }

  try {
    // Crear todas las tablas
    for (const [tableName, schema] of Object.entries(tableSchema)) {
      await pool.query(schema.postgres);
      console.log(`✓ Tabla creada/verificada: ${tableName}`);
    }

    // Migrar columnas faltantes (ANTES de crear índices que dependen de ellas)
    for (const [tableName, schema] of Object.entries(tableSchema)) {
      if (schema.columns) {
        await migrateColumnsPostgres(pool, tableName, schema.columns);
      }
    }

    // Fix any existing is_active BOOLEAN columns back to INTEGER for consistency
    await fixIsActiveBooleanToInteger(pool);

    // Fix user_id columns from INTEGER to TEXT if they were created with an old schema
    await fixUserIdTypes(pool);

    // Fix primary key id columns from INTEGER to TEXT for backup tables
    await fixIdTypes(pool);

    // Fix subject_id columns from INTEGER to TEXT
    await fixSubjectIdTypes(pool);

    // Triggers de actualización de timestamps
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
         NEW.updated_at = NOW();
         RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_courses_timestamp ON courses;
      CREATE TRIGGER update_courses_timestamp
      BEFORE UPDATE ON courses
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Crear índices únicos (DESPUÉS de asegurarse que las columnas existen)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique 
      ON users(username) WHERE username IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_pin_unique 
      ON users(share_pin) WHERE share_pin IS NOT NULL
    `);

    // Índice único para youtube_transcripts (permite ON CONFLICT)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_yt_transcripts_video_id 
      ON youtube_transcripts(video_id)
    `);

    // Índices de rendimiento
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_decks_user_created 
      ON flashcard_decks(user_id, created_at)
    `);

    // ── Migración de Legacy Cards (SM-2 Bootstrapping) ──────────────────────
    // NOTA: next_review_date se deja en NULL intencionalmente.
    // Según SM-2, las tarjetas sin primera revisión no tienen intervalo.
    // Solo después del primer repaso (vía POST /flashcards/:cardId/review)
    // se asigna next_review_date = NOW + 1 día (I(1) = 1).
    try {
      const legacyResult = await pool.query(`
        UPDATE flashcards
        SET
          is_atomic         = COALESCE(is_atomic, 1),
          sm2_ease_factor   = COALESCE(sm2_ease_factor, 2.5),
          sm2_interval      = COALESCE(sm2_interval, 1),
          sm2_repetitions   = COALESCE(sm2_repetitions, 0)
        WHERE next_review_date IS NULL AND status IN ('new', 'learning')
      `);
      if (legacyResult.rowCount > 0) {
        console.log(`✅ [Migración SM-2] ${legacyResult.rowCount} tarjeta(s) legacy bootstrapeadas (next_review_date=NULL — sin repaso urgente).`);
      }
    } catch (migErr) {
      console.warn('⚠️ Migración de legacy cards omitida (posiblemente columna no existe aún):', migErr.message);
    }
    // ────────────────────────────────────────────────────────────────────────

    // Crear usuario por defecto
    const { rows: existingUser } = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      ['user']
    );

    if (existingUser.length === 0) {
      const defaultPasswordHash = bcrypt.hashSync('1234', 10);
      const defaultUserId = uuidv4();
      await pool.query(
        `INSERT INTO users (id, email, password_hash, name, lastname, username, share_pin)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [defaultUserId, 'user', defaultPasswordHash, 'Default', 'User', 'user', 'ABC123']
      );
      console.log('✓ Usuario por defecto creado: user / 1234 (UUID: ' + defaultUserId + ')');
    } else {
      // Asegurarse de que el usuario existente tenga el PIN asignado
      await pool.query(
        `UPDATE users SET share_pin = 'ABC123' WHERE email = 'user' AND (share_pin IS NULL OR share_pin = '')`
      );
    }

    // Insertar fila inicial de sync_version si no existe
    await pool.query(`INSERT INTO sync_version (id, version) VALUES (1, 0) ON CONFLICT (id) DO NOTHING`);
    console.log('✓ sync_version seeded');

    // Agregar columna sync_version a tablas sincronizables si no existe
    const syncTables = ['courses', 'subjects', 'assessments', 'schedules', 'flashcard_decks', 'flashcards', 'calendar_events', 'grading_periods', 'lms_accounts', 'subject_threshold_overrides', 'photos', 'audio_recordings', 'scanned_documents', 'study_sessions', 'ai_chats', 'youtube_videos', 'assessment_files'];
    for (const t of syncTables) {
      try {
        await pool.query(`ALTER TABLE ${t} ADD COLUMN sync_version INTEGER DEFAULT 0`);
        console.log(`  ✓ sync_version column added to ${t}`);
      } catch (e) {
        if (e.message && e.message.includes('already exists')) {
          // columna ya existe, ignorar
        } else {
          console.warn(`  ⚠ sync_version column skipped for ${t}: ${e.message}`);
        }
      }
    }
    console.log('✓ sync_version columns verified');

    // Agregar version_number y updated_at a tablas que los usan en controllers
    const versionNumberTables = ['ai_chats', 'youtube_videos', 'assessment_files'];
    for (const t of versionNumberTables) {
      try {
        await pool.query(`ALTER TABLE ${t} ADD COLUMN version_number INTEGER DEFAULT 0`);
        console.log(`  ✓ version_number column added to ${t}`);
      } catch (e) {
        if (e.message && e.message.includes('already exists')) {
          // columna ya existe, ignorar
        } else {
          console.warn(`  ⚠ version_number column skipped for ${t}: ${e.message}`);
        }
      }
      try {
        await pool.query(`ALTER TABLE ${t} ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        console.log(`  ✓ updated_at column added to ${t}`);
      } catch (e) {
        if (e.message && e.message.includes('already exists')) {
          // columna ya existe, ignorar
        } else {
          console.warn(`  ⚠ updated_at column skipped for ${t}: ${e.message}`);
        }
      }
    }

    console.log('✅ Base de datos PostgreSQL inicializada correctamente.');
    await seedGradingSystemsPostgres(pool);
  } catch (err) {
    console.error('❌ Error inicializando PostgreSQL:', err.message);
  }
};

module.exports = initializePostgresDb;
