/**
 * Migration: add-sync-version.js
 *
 * Crea la tabla sync_version y agrega columna sync_version
 * a todas las tablas de entidades para delta sync basado en
 * contador monotónico en vez de timestamps.
 *
 * Ejecutar: node database/migrations/add-sync-version.js
 */
const { db } = require('../../db');

const statements = [
  // Tabla del contador global de sync
  `CREATE TABLE IF NOT EXISTS sync_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  // Insertar fila única si no existe
  `INSERT OR IGNORE INTO sync_version (id, version) VALUES (1, 0)`,
  // Columna sync_version en cada tabla de entidad
  `ALTER TABLE courses ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE subjects ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE assessments ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE schedules ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE flashcard_decks ADD COLUMN sync_version INTEGER DEFAULT 0`,
  `ALTER TABLE flashcards ADD COLUMN sync_version INTEGER DEFAULT 0`,
];

function run(i) {
  if (i >= statements.length) {
    console.log('[Migration] sync_version migration completed');
    process.exit(0);
    return;
  }
  db.run(statements[i], (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error(`[Migration] Error en statement ${i}:`, err.message);
    }
    run(i + 1);
  });
}

run(0);
