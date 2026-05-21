const bcrypt = require('bcrypt');
const tableSchema = require('./schema');
const { migrateColumnsSqlite } = require('./migrations');
const { seedGradingSystemsSqlite } = require('./seeders');

const initializeSqliteDb = (db) => {
  return new Promise((resolve) => {
    db.serialize(async () => {
      // Asegurar que foreign keys estén ON para esta sesión
      db.run('PRAGMA foreign_keys = ON');

      // Crear todas las tablas
      for (const [tableName, schema] of Object.entries(tableSchema)) {
        db.run(schema.sqlite, (err) => {
          if (err) {
            console.error(`Error creando tabla ${tableName}:`, err.message);
          } else {
            console.log(`✓ Tabla creada/verificada: ${tableName}`);
          }
        });
      }

      // Crear índices únicos
      db.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL`,
        (err) => {
          if (err) console.error('Error creando índice único (username):', err.message);
        }
      );

      db.run(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_share_pin_unique ON users(share_pin) WHERE share_pin IS NOT NULL`,
        (err) => {
          if (err) console.error('Error creando índice único (share_pin):', err.message);
        }
      );

      // Índices de rendimiento
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_decks_user_created ON flashcard_decks(user_id, created_at)`,
        (err) => {
          if (err) console.error('Error creando índice de rendimiento (idx_decks_user_created):', err.message);
        }
      );

      // Migrar columnas faltantes con promesas
      const migrateAll = async () => {
        for (const [tableName, schema] of Object.entries(tableSchema)) {
          if (schema.columns) {
            await migrateColumnsSqlite(db, tableName, schema.columns);
          }
        }

        // ── Migración de Legacy Cards (SM-2 Bootstrapping) ────────────────────
        // Garantiza que todas las tarjetas legacy entren al ciclo SM-2.
        // Las tarjetas creadas antes del sistema de repetición espaciada tienen
        // next_review_date = NULL, lo que las hace invisibles para el predictor.
        await new Promise((res) => {
          db.run(
            `UPDATE flashcards
             SET
               next_review_date  = CURRENT_TIMESTAMP,
               is_atomic         = COALESCE(is_atomic, 1),
               sm2_ease_factor   = COALESCE(sm2_ease_factor, 2.5),
               sm2_interval      = COALESCE(sm2_interval, 1),
               sm2_repetitions   = COALESCE(sm2_repetitions, 0)
             WHERE next_review_date IS NULL`,
            function (err) {
              if (err) {
                console.error('❌ Error en migración de legacy cards:', err.message);
              } else if (this.changes > 0) {
                console.log(`✅ [Migración SM-2] ${this.changes} tarjeta(s) legacy inicializadas con next_review_date = NOW.`);
              }
              res();
            }
          );
        });
        // ─────────────────────────────────────────────────────────────────────

        // Crear usuario por defecto
        db.get(`SELECT id FROM users WHERE email = ?`, ['user'], (err, existingUser) => {
          if (err) {
            console.error('Error verificando usuario por defecto:', err.message);
            resolve();
            return;
          }

          if (existingUser) {
            db.run(
              `UPDATE users SET share_pin = 'ABC123' WHERE email = 'user' AND (share_pin IS NULL OR share_pin = '')`,
              () => {
                seedGradingSystemsSqlite(db).then(() => resolve());
              }
            );
            return;
          }

          const defaultPasswordHash = bcrypt.hashSync('1234', 10);
          db.run(
            `INSERT INTO users (email, password_hash, name, lastname, username, share_pin)
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['user', defaultPasswordHash, 'Default', 'User', 'user', 'ABC123'],
            (seedErr) => {
              if (seedErr) {
                console.error('Error creando usuario por defecto:', seedErr.message);
              } else {
                console.log('✓ Usuario por defecto creado: user / 1234');
              }
              console.log('✅ Base de datos SQLite inicializada correctamente.');
              seedGradingSystemsSqlite(db).then(() => resolve());
            }
          );
        });
      };

      migrateAll();
    });
  });
};

module.exports = initializeSqliteDb;
