/**
 * Migration: add-sync-deletions-table.js
 *
 * Crea la tabla sync_deletions para rastrear eliminaciones
 * y poder distribuirlas vía delta sync a otros dispositivos.
 *
 * Ejecutar: node database/migrations/add-sync-deletions-table.js
 */
const { db } = require('../../db');

const SQL = `
CREATE TABLE IF NOT EXISTS sync_deletions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  deleted_at TEXT DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id, user_id)
);
`;

db.run(SQL, (err) => {
  if (err) {
    console.error('[Migration] Error creando sync_deletions:', err.message);
    process.exit(1);
  }
  console.log('[Migration] Tabla sync_deletions creada correctamente');
  process.exit(0);
});
