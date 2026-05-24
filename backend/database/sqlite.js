const bcrypt = require('bcrypt');
const path = require('path');
const tableSchema = require('./schema');
const { seedGradingSystemsSqlite } = require('./seeders');

// Promisify db.run, db.get, db.all for sequential execution
const dbRun = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const initializeSqliteDb = async (db) => {
  try {
    console.log('[DB Init] 📋 Inicializando SQLite...');

    // Step 0: PRAGMA foreign_keys
    await dbRun(db, 'PRAGMA foreign_keys = ON');
    console.log('✓ PRAGMA foreign_keys = ON habilitado.');

    // Step 1: Create all tables - SEQUENTIALLY
    console.log('[DB Init] 📋 Paso 1: Creando tablas...');
    console.log(`[DB Init] Total de tablas: ${Object.keys(tableSchema).length}`);
    
    for (const [tableName, schema] of Object.entries(tableSchema)) {
      console.log(`[DB Init] 🔄 Creando tabla: ${tableName}...`);
      try {
        const result = await dbRun(db, schema.sqlite);
        console.log(`✓ Tabla creada/verificada: ${tableName}`, result);
      } catch (err) {
        console.error(`❌ Error creando tabla ${tableName}:`, err.message);
      }
    }

    // Step 2: Create indexes - SEQUENTIALLY
    console.log('[DB Init] 📊 Paso 2: Creando índices...');
    const indexes = [
      {
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL`,
        name: 'idx_users_username_unique'
      },
      {
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_pin_unique ON users(share_pin) WHERE share_pin IS NOT NULL`,
        name: 'idx_users_share_pin_unique'
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS idx_decks_user_created ON flashcard_decks(user_id, created_at)`,
        name: 'idx_decks_user_created'
      }
    ];

    for (const index of indexes) {
      try {
        await dbRun(db, index.sql);
        console.log(`✓ Índice creado: ${index.name}`);
      } catch (err) {
        console.error(`Error creando índice ${index.name}:`, err.message);
      }
    }

    // Step 3: Migrate missing columns - SEQUENTIALLY
    console.log('[DB Init] 🔄 Paso 3: Migrando columnas faltantes...');
    for (const [tableName, schema] of Object.entries(tableSchema)) {
      if (schema.columns) {
        try {
          const rows = await dbAll(db, `PRAGMA table_info(${tableName})`);
          const existingColumns = new Set(rows.map((row) => row.name));
          const missingColumns = schema.columns.filter((col) => !existingColumns.has(col.name));

          for (const column of missingColumns) {
            try {
              await dbRun(db, `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`);
              console.log(`✓ Columna agregada en ${tableName}: ${column.name}`);
            } catch (err) {
              console.error(`Error agregando columna ${column.name} en ${tableName}:`, err.message);
            }
          }
        } catch (err) {
          console.error(`Error migrando columnas de ${tableName}:`, err.message);
        }
      }
    }

    // Step 4: Legacy card migration (SM-2 Bootstrapping)
    // NOTA: next_review_date se deja en NULL intencionalmente.
    // Según SM-2, las tarjetas sin primera revisión no tienen intervalo.
    console.log('[DB Init] 🔄 Paso 4: Migrando tarjetas legacy...');
    try {
      const result = await dbRun(db, `
        UPDATE flashcards
        SET
          is_atomic         = COALESCE(is_atomic, 1),
          sm2_ease_factor   = COALESCE(sm2_ease_factor, 2.5),
          sm2_interval      = COALESCE(sm2_interval, 1),
          sm2_repetitions   = COALESCE(sm2_repetitions, 0)
        WHERE next_review_date IS NULL AND status IN ('new', 'learning')
      `);
      if (result.changes > 0) {
        console.log(`✅ [Migración SM-2] ${result.changes} tarjeta(s) legacy bootstrapeadas (next_review_date=NULL).`);
      }
    } catch (err) {
      console.error('Error en migración de legacy cards:', err.message);
    }

    // Step 5: Create default user
    console.log('[DB Init] 👤 Paso 5: Verificando usuario por defecto...');
    try {
      const existingUser = await dbGet(db, `SELECT id FROM users WHERE email = ?`, ['user']);

      if (existingUser) {
        await dbRun(db, `UPDATE users SET share_pin = 'ABC123' WHERE email = 'user' AND (share_pin IS NULL OR share_pin = '')`);
        console.log('✓ Usuario por defecto actualizado');
      } else {
        const defaultPasswordHash = bcrypt.hashSync('1234', 10);
        await dbRun(db, 
          `INSERT INTO users (email, password_hash, name, lastname, username, share_pin) VALUES (?, ?, ?, ?, ?, ?)`,
          ['user', defaultPasswordHash, 'Default', 'User', 'user', 'ABC123']
        );
        console.log('✓ Usuario por defecto creado: user / 1234');
      }
    } catch (err) {
      console.error('Error en usuario por defecto:', err.message);
    }

    // Step 6: Seed grading systems
    console.log('[DB Init] 🌱 Paso 6: Inicializando sistemas de calificación...');
    await seedGradingSystemsSqlite(db);

    console.log('✅ Base de datos SQLite inicializada correctamente.');
    return Promise.resolve();
  } catch (err) {
    console.error('❌ Error fatal en inicialización de SQLite:', err.message);
    return Promise.resolve(); // Don't throw, let app continue with partial init
  }
};

module.exports = initializeSqliteDb;
