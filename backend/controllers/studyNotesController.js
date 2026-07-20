const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, updateWithVersionGuard, removeDeletion, respondStaleVersion } = require('../helpers/syncVersion');

/**
 * Obtener todos los apuntes de un usuario
 */
exports.getStudyNotesByUser = (req, res) => {
  const { userId } = req.params;
  db.all(
    'SELECT * FROM study_notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
};

/**
 * Obtener apuntes de una materia
 */
exports.getStudyNotesBySubject = (req, res) => {
  const { subjectId } = req.params;
  const userId = req.user.id;
  db.all(
    'SELECT * FROM study_notes WHERE subject_id = ? AND user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
    [subjectId, userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
};

/**
 * Crear o re-sincronizar un apunte (ON CONFLICT idempotente)
 */
exports.createStudyNote = (req, res) => {
  const { id: clientId, user_id, subject_id, title, content, media_paths, source, origin, processing_state, ai_summary, ai_keywords, sync_version: incomingVersion, version_number } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id es requerido' });
  }

  const authenticatedUserId = req.user.id;
  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const noteId = clientId || uuidv4();
  const hasVersion = incomingVersion !== undefined && incomingVersion !== null;

  const query = `
    INSERT INTO study_notes (id, user_id, subject_id, title, content, media_paths, source, origin, processing_state, ai_summary, ai_keywords, version_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0))
    ON CONFLICT(id) DO UPDATE SET
      subject_id = excluded.subject_id,
      title = excluded.title,
      content = excluded.content,
      media_paths = COALESCE(excluded.media_paths, study_notes.media_paths),
      source = excluded.source,
      origin = excluded.origin,
      processing_state = excluded.processing_state,
      ai_summary = COALESCE(excluded.ai_summary, study_notes.ai_summary),
      ai_keywords = COALESCE(excluded.ai_keywords, study_notes.ai_keywords),
      version_number = COALESCE(excluded.version_number, study_notes.version_number + 1),
      updated_at = datetime('now')
      ${hasVersion ? 'WHERE study_notes.sync_version IS NULL OR study_notes.sync_version <= ?' : ''}
  `;

  const params = [
    noteId, user_id, subject_id || null, title || null, content || null,
    media_paths || null, source || 'manual', origin || null,
    processing_state || 'draft', ai_summary || null, ai_keywords || null,
    version_number || 0
  ];
  if (hasVersion) params.push(incomingVersion);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    removeDeletion('study_notes', noteId, user_id);
    incrementSyncVersion('study_notes', noteId, () => {
      res.status(201).json({ success: true, id: noteId });
    });
  });
};

/**
 * Actualizar un apunte (con version guard)
 */
exports.updateStudyNote = (req, res) => {
  const { id } = req.params;
  const { sync_version: incomingVersion, version_number, ...fields } = req.body;
  const userId = req.user.id;

  db.get('SELECT id, user_id FROM study_notes WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Apunte no encontrado o acceso denegado' });

    const allowedFields = ['subject_id', 'title', 'content', 'media_paths', 'source', 'origin', 'processing_state', 'ai_summary', 'ai_keywords'];
    const fieldsToUpdate = {};

    for (const key of Object.keys(fields)) {
      if (allowedFields.includes(key)) {
        fieldsToUpdate[key] = fields[key];
      }
    }

    if (version_number !== undefined) fieldsToUpdate['version_number'] = version_number;
    fieldsToUpdate['updated_at'] = new Date().toISOString();

    if (Object.keys(fieldsToUpdate).length === 1 && fieldsToUpdate['updated_at']) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const columns = Object.keys(fieldsToUpdate);
    const values = Object.values(fieldsToUpdate);

    updateWithVersionGuard('study_notes', id, columns, values, incomingVersion, (err, changes) => {
      if (err) return res.status(500).json({ error: err.message });
      if (changes === 0) return respondStaleVersion(res, 'study_notes', id);
      incrementSyncVersion('study_notes', id, () => {
        res.json({ success: true, changes });
      });
    });
  });
};

/**
 * Eliminar un apunte (soft delete + sync_deletions)
 */
exports.deleteStudyNote = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.get('SELECT id FROM study_notes WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Apunte no encontrado o acceso denegado' });

    recordDeletion('study_notes', id, userId, () => {
      incrementSyncCounterOnly(() => {
        db.run('DELETE FROM study_notes WHERE id = ? AND user_id = ?', [id, userId], function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, changes: this.changes });
        });
      });
    });
  });
};
