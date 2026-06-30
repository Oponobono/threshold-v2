const { db } = require('../db');

function incrementSyncVersion(tableName, entityId, callback) {
  callback = callback || (() => {});
  db.run(
    `UPDATE sync_version SET version = version + 1, updated_at = datetime('now') WHERE id = 1`,
    [],
    function (err) {
      if (err) {
        console.error(`[SyncVersion] Error incrementando contador para ${tableName}:${entityId}:`, err.message);
        return callback(err);
      }
      db.get(`SELECT version FROM sync_version WHERE id = 1`, [], (err2, row) => {
        if (err2 || !row) {
          console.error(`[SyncVersion] Error leyendo contador para ${tableName}:${entityId}:`, err2 ? err2.message : 'no row');
          return callback(err2 || new Error('No sync_version row'));
        }
        const newVersion = row.version;
        db.run(
          `UPDATE ${tableName} SET sync_version = ? WHERE id = ?`,
          [newVersion, entityId],
          function (err3) {
            if (err3) {
              console.error(`[SyncVersion] Error actualizando ${tableName}:${entityId} a version ${newVersion}:`, err3.message);
              return callback(err3);
            }
            if (callback) callback(null, newVersion);
          }
        );
      });
    }
  );
}

function recordDeletion(entityType, entityId, userId, callback) {
  callback = callback || (() => {});
  db.run(
    `INSERT INTO sync_deletions (entity_type, entity_id, user_id, deleted_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(entity_type, entity_id, user_id) DO UPDATE SET deleted_at = datetime('now')`,
    [entityType, String(entityId), String(userId)],
    function (err) {
      if (err) console.error(`[SyncDeletions] Error registrando eliminación de ${entityType}:${entityId}:`, err.message);
      if (callback) callback(err);
    }
  );
}

function recordDeletions(entityType, ids, userId, callback) {
  callback = callback || (() => {});
  if (!ids || ids.length === 0) return callback(null);
  let i = 0;
  const next = () => {
    if (i >= ids.length) return callback(null);
    const id = ids[i++];
    db.run(
      `INSERT INTO sync_deletions (entity_type, entity_id, user_id, deleted_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(entity_type, entity_id, user_id) DO UPDATE SET deleted_at = datetime('now')`,
      [entityType, String(id), String(userId)],
      function () { next(); }
    );
  };
  next();
}

function incrementSyncCounterOnly(callback) {
  callback = callback || (() => {});
  db.run(
    `UPDATE sync_version SET version = version + 1, updated_at = datetime('now') WHERE id = 1`,
    [],
    function (err) {
      if (err) {
        console.error(`[SyncVersion] Error incrementando contador global:`, err.message);
        return callback(err);
      }
      db.get(`SELECT version FROM sync_version WHERE id = 1`, [], (err2, row) => {
        if (err2 || !row) {
          console.error(`[SyncVersion] Error leyendo contador:`, err2 ? err2.message : 'no row');
          return callback(err2 || new Error('No sync_version row'));
        }
        if (callback) callback(null, row.version);
      });
    }
  );
}

module.exports = { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, recordDeletions };
