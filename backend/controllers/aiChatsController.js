const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, recordDeletions, updateWithVersionGuard, removeDeletion, respondStaleVersion } = require('../helpers/syncVersion');

/**
 * Obtener todos los chats de un usuario
 */
exports.getAiChats = (req, res) => {
  const { userId } = req.params;
  const query = `SELECT * FROM ai_chats WHERE user_id = ? ORDER BY created_at ASC`;
  
  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

/**
 * Crear o re-crear un mensaje de chat
 */
exports.createAiChat = (req, res) => {
  const { id: clientId, user_id, subject_id, role, content, cloud_url, sync_version: incomingVersion, version_number } = req.body;
  
  if (!user_id || !role || !content) {
    return res.status(400).json({ error: 'Faltan campos requeridos: user_id, role, content' });
  }

  const authenticatedUserId = req.user.id;
  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const chatId = clientId || uuidv4();
  const hasVersion = incomingVersion !== undefined && incomingVersion !== null;
  
  const query = `
    INSERT INTO ai_chats (id, user_id, subject_id, role, content, cloud_url, version_number)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, 0))
    ON CONFLICT(id) DO UPDATE SET
      subject_id = excluded.subject_id,
      role = excluded.role,
      content = excluded.content,
      cloud_url = excluded.cloud_url,
      version_number = COALESCE(excluded.version_number, ai_chats.version_number + 1),
      updated_at = datetime('now')
      ${hasVersion ? 'WHERE ai_chats.sync_version IS NULL OR ai_chats.sync_version <= ?' : ''}
  `;
  
  const params = [chatId, user_id, subject_id || null, role, content, cloud_url || null, version_number || 0];
  if (hasVersion) params.push(incomingVersion);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    removeDeletion('ai_chats', chatId, user_id);
    incrementSyncVersion('ai_chats', chatId, () => {
      res.status(201).json({ success: true, id: chatId });
    });
  });
};

/**
 * Actualizar un mensaje (casos raros, pero soportado)
 */
exports.updateAiChat = (req, res) => {
  const { id } = req.params;
  const { sync_version: incomingVersion, version_number } = req.body;
  const fields = req.body;
  const userId = req.user.id;
  
  const allowedFields = ['subject_id', 'role', 'content', 'cloud_url'];
  const fieldsToUpdate = {};
  
  for (const key of Object.keys(fields)) {
    if (allowedFields.includes(key)) {
      fieldsToUpdate[key] = fields[key];
    }
  }
  
  if (version_number !== undefined) {
    fieldsToUpdate['version_number'] = version_number;
  }
  fieldsToUpdate['updated_at'] = new Date().toISOString();

  if (Object.keys(fieldsToUpdate).length === 1 && fieldsToUpdate['updated_at']) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }
  
  const columns = Object.keys(fieldsToUpdate);
  const values = Object.values(fieldsToUpdate);

  updateWithVersionGuard('ai_chats', id, columns, values, incomingVersion, (err, changes) => {
    if (err) return res.status(500).json({ error: err.message });
    if (changes === 0) {
      return db.get('SELECT id, user_id FROM ai_chats WHERE id = ?', [id], (checkErr, checkRow) => {
        if (checkErr || !checkRow || String(checkRow.user_id) !== String(userId)) {
          return res.status(404).json({ error: 'Chat no encontrado o acceso denegado' });
        }
        return respondStaleVersion(res, 'ai_chats', id);
      });
    }
    incrementSyncVersion('ai_chats', id, () => {
      res.json({ success: true, changes });
    });
  });
};

/**
 * Eliminar un mensaje
 */
exports.deleteAiChat = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  db.get('SELECT id FROM ai_chats WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Chat no encontrado o acceso denegado' });

    recordDeletion('ai_chats', id, userId, () => {
      incrementSyncCounterOnly(() => {
        db.run(`DELETE FROM ai_chats WHERE id = ? AND user_id = ?`, [id, userId], function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, changes: this.changes });
        });
      });
    });
  });
};
