const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, updateWithVersionGuard, removeDeletion, respondStaleVersion } = require('../helpers/syncVersion');

exports.getCourses = (req, res) => {
  const userId = req.user.id;
  db.all('SELECT * FROM courses WHERE user_id = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

exports.getCourseById = (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;
  db.get('SELECT * FROM courses WHERE id = ? AND user_id = ?', [courseId, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Curso no encontrado' });
    res.json(row);
  });
};


exports.createCourse = (req, res) => {
  const { id: clientId, user_id, name, platform, certificate_url, main_url, deep_link_url, instructor, total_hours, total_classes, completed_classes, status, global_notes, tags, momentum_score, last_studied_at, sync_version: incomingVersion } = req.body;
  const authenticatedUserId = req.user.id;

  if (!user_id || !name) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, name)' });
  }

  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const courseId = clientId || uuidv4();
  const hasVersion = incomingVersion !== undefined && incomingVersion !== null;

  const query = `
    INSERT INTO courses (id, user_id, name, platform, certificate_url, main_url, deep_link_url, instructor, total_hours, total_classes, completed_classes, status, global_notes, tags, momentum_score, last_studied_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      platform = EXCLUDED.platform,
      certificate_url = EXCLUDED.certificate_url,
      main_url = EXCLUDED.main_url,
      deep_link_url = EXCLUDED.deep_link_url,
      instructor = EXCLUDED.instructor,
      total_hours = EXCLUDED.total_hours,
      total_classes = EXCLUDED.total_classes,
      completed_classes = EXCLUDED.completed_classes,
      status = EXCLUDED.status,
      global_notes = EXCLUDED.global_notes,
      tags = EXCLUDED.tags,
      momentum_score = EXCLUDED.momentum_score,
      last_studied_at = EXCLUDED.last_studied_at,
      updated_at = CURRENT_TIMESTAMP${hasVersion ? ' WHERE courses.sync_version IS NULL OR courses.sync_version <= ?' : ''}
  `;

  const params = [courseId, user_id, name, platform, certificate_url, main_url, deep_link_url, instructor, total_hours || 0, total_classes || 0, completed_classes || 0, status || 'active', global_notes, tags, momentum_score || 1.0, last_studied_at];
  if (hasVersion) params.push(incomingVersion);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    removeDeletion('courses', courseId, user_id);
    incrementSyncVersion('courses', courseId, () => {
      res.status(201).json({ id: courseId, user_id, name, platform, certificate_url, main_url, deep_link_url, instructor, total_hours: total_hours || 0, total_classes: total_classes || 0, completed_classes: completed_classes || 0, status: status || 'active', global_notes, tags, momentum_score: momentum_score || 1.0, last_studied_at });
    });
  });
};

exports.updateCourse = (req, res) => {
  const { courseId } = req.params;
  const { sync_version: incomingVersion } = req.body;
  const fields = req.body;
  
  const allowedFields = ['name', 'platform', 'certificate_url', 'main_url', 'deep_link_url', 'instructor', 'total_hours', 'total_classes', 'completed_classes', 'status', 'global_notes', 'tags', 'momentum_score', 'last_studied_at', 'updated_at'];
  const fieldsToUpdate = {};
  
  for (const key of Object.keys(fields)) {
    if (allowedFields.includes(key)) {
      fieldsToUpdate[key] = fields[key];
    }
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos válidos para actualizar' });
  }

  const columns = Object.keys(fieldsToUpdate);
  const values = Object.values(fieldsToUpdate);

  updateWithVersionGuard('courses', courseId, columns, values, incomingVersion, (err, changes) => {
    if (err) return res.status(500).json({ error: err.message });
    if (changes === 0) return respondStaleVersion(res, 'courses', courseId);
    incrementSyncVersion('courses', courseId, () => { res.json({ success: true }); });
  });
};

exports.deleteCourse = (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;
  
  db.run('DELETE FROM courses WHERE id = ? AND user_id = ?', [courseId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    recordDeletion('courses', courseId, req.user.id, () => {
      incrementSyncCounterOnly(() => {
        res.json({ success: true });
      });
    });
  });
};
