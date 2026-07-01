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
  incrementSyncCounterOnly((err, version) => {
    if (err) return callback(err);
    db.run(
      `INSERT INTO sync_deletions (entity_type, entity_id, user_id, deleted_at, deletion_version) VALUES (?, ?, ?, datetime('now'), ?)
       ON CONFLICT(entity_type, entity_id, user_id) DO UPDATE SET deleted_at = datetime('now'), deletion_version = ?`,
      [entityType, String(entityId), String(userId), version, version],
      function (err) {
        if (err) console.error(`[SyncDeletions] Error registrando eliminación de ${entityType}:${entityId}:`, err.message);
        if (callback) callback(err);
      }
    );
  });
}

function recordDeletions(entityType, ids, userId, callback) {
  callback = callback || (() => {});
  if (!ids || ids.length === 0) return callback(null);
  incrementSyncCounterOnly((err, version) => {
    if (err) return callback(err);
    let i = 0;
    const next = () => {
      if (i >= ids.length) return callback(null);
      const id = ids[i++];
      db.run(
        `INSERT INTO sync_deletions (entity_type, entity_id, user_id, deleted_at, deletion_version) VALUES (?, ?, ?, datetime('now'), ?)
         ON CONFLICT(entity_type, entity_id, user_id) DO UPDATE SET deleted_at = datetime('now'), deletion_version = ?`,
        [entityType, String(id), String(userId), version, version],
        function () { next(); }
      );
    };
    next();
  });
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

function updateWithVersionGuard(tableName, entityId, fields, values, incomingVersion, callback) {
  const setClause = fields.map(key => `${key} = ?`).join(', ');
  if (incomingVersion !== undefined && incomingVersion !== null) {
    db.run(
      `UPDATE ${tableName} SET ${setClause} WHERE id = ? AND sync_version <= ?`,
      [...values, entityId, incomingVersion],
      function (err) {
        if (err) return callback(err);
        callback(null, this.changes);
      }
    );
  } else {
    db.run(
      `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
      [...values, entityId],
      function (err) {
        if (err) return callback(err);
        callback(null, this.changes);
      }
    );
  }
}

function respondStaleVersion(res, tableName, entityId) {
  db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [entityId], (err, row) => {
    res.status(409).json({
      reason: 'STALE_VERSION',
      current_sync_version: row?.sync_version ?? null,
      entity: err || !row ? null : row,
      error: 'Conflicto: los datos del servidor son más recientes. Re-sincroniza antes de actualizar.',
    });
  });
}

function removeDeletion(entityType, entityId, userId) {
  db.run(
    `DELETE FROM sync_deletions WHERE entity_type = ? AND entity_id = ? AND user_id = ?`,
    [entityType, String(entityId), String(userId)]
  );
}

module.exports = { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, recordDeletions, updateWithVersionGuard, removeDeletion, respondStaleVersion };
