const bcrypt = require('bcrypt');
const tableSchema = require('./schema');
const { migrateColumnsPostgres } = require('./migrations');
const { seedGradingSystemsPostgres } = require('./seeders');

const initializePostgresDb = async (pool) => {
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

    // Crear índices únicos (DESPUÉS de asegurarse que las columnas existen)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique 
      ON users(username) WHERE username IS NOT NULL
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_pin_unique 
      ON users(share_pin) WHERE share_pin IS NOT NULL
    `);

    // Índices de rendimiento
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_decks_user_created 
      ON flashcard_decks(user_id, created_at)
    `);

    // ── Migración de Legacy Cards (SM-2 Bootstrapping) ──────────────────────
    try {
      const legacyResult = await pool.query(`
        UPDATE flashcards
        SET
          next_review_date  = NOW(),
          is_atomic         = COALESCE(is_atomic, 1),
          sm2_ease_factor   = COALESCE(sm2_ease_factor, 2.5),
          sm2_interval      = COALESCE(sm2_interval, 1),
          sm2_repetitions   = COALESCE(sm2_repetitions, 0)
        WHERE next_review_date IS NULL
      `);
      if (legacyResult.rowCount > 0) {
        console.log(`✅ [Migración SM-2] ${legacyResult.rowCount} tarjeta(s) legacy inicializadas con next_review_date = NOW.`);
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
      await pool.query(
        `INSERT INTO users (email, password_hash, name, lastname, username, grading_scale, approval_threshold, share_pin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['user', defaultPasswordHash, 'Default', 'User', 'user', '0-5.0', 3.0, 'ABC123']
      );
      console.log('✓ Usuario por defecto creado: user / 1234 (PIN: ABC123)');
    } else {
      // Asegurarse de que el usuario existente tenga el PIN asignado
      await pool.query(
        `UPDATE users SET share_pin = 'ABC123' WHERE email = 'user' AND (share_pin IS NULL OR share_pin = '')`
      );
    }

    console.log('✅ Base de datos PostgreSQL inicializada correctamente.');
    await seedGradingSystemsPostgres(pool);
  } catch (err) {
    console.error('❌ Error inicializando PostgreSQL:', err.message);
  }
};

module.exports = initializePostgresDb;
