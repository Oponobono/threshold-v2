const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, recordDeletions, updateWithVersionGuard, removeDeletion, respondStaleVersion } = require('../helpers/syncVersion');

/**
 * Helper para validar el acceso al assessment y obtener su subject/user_id
 */
const verifyAssessmentAccess = (assessmentId, userId, callback) => {
  const query = `
    SELECT a.id, s.user_id 
    FROM assessments a 
    JOIN subjects s ON a.subject_id = s.id 
    WHERE a.id = ? AND s.user_id = ?
  `;
  db.get(query, [assessmentId, userId], (err, row) => {
    if (err) return callback(err, null);
    if (!row) return callback(new Error('Assessment no encontrado o acceso denegado'), null);
    callback(null, row);
  });
};

/**
 * Subir o re-sincronizar un archivo (Upload / Sync Push)
 */
exports.uploadAssessmentFile = (req, res) => {
  const { assessmentId } = req.params;
  const userId = req.user.id;
  const { id: clientId, file_name, file_type, file_size, cloud_url, sync_version: incomingVersion, version_number } = req.body;

  if (!assessmentId || !file_name) {
    return res.status(400).json({ error: 'assessmentId y file_name son requeridos' });
  }

  verifyAssessmentAccess(assessmentId, userId, (err) => {
    if (err) return res.status(403).json({ error: err.message });

    const fileId = clientId || req.body.id || uuidv4();
    const hasVersion = incomingVersion !== undefined && incomingVersion !== null;
    
    // Omitimos local_uri intencionalmente en el INSERT (Asset Pattern)
    const query = `
      INSERT INTO assessment_files (id, assessment_id, file_name, file_type, cloud_url, file_size, is_backed_up, version_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0))
      ON CONFLICT(id) DO UPDATE SET
        assessment_id = excluded.assessment_id,
        file_name = excluded.file_name,
        file_type = excluded.file_type,
        cloud_url = COALESCE(excluded.cloud_url, assessment_files.cloud_url),
        file_size = excluded.file_size,
        is_backed_up = CASE WHEN excluded.cloud_url IS NOT NULL THEN 1 ELSE assessment_files.is_backed_up END,
        version_number = COALESCE(excluded.version_number, assessment_files.version_number + 1),
        updated_at = datetime('now')
        ${hasVersion ? 'WHERE assessment_files.sync_version IS NULL OR assessment_files.sync_version <= ?' : ''}
    `;
    
    const isBackedUp = cloud_url ? 1 : 0;
    const params = [fileId, assessmentId, file_name, file_type || null, cloud_url || null, file_size || 0, isBackedUp, version_number || 0];
    if (hasVersion) params.push(incomingVersion);

    db.run(query, params, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      removeDeletion('assessment_files', fileId, userId);
      incrementSyncVersion('assessment_files', fileId, () => {
        res.status(201).json({ success: true, id: fileId });
      });
    });
  });
};

/**
 * Actualizar metadatos (Sync UPDATE)
 */
exports.updateAssessmentFile = (req, res) => {
  const { fileId } = req.params;
  const { sync_version: incomingVersion, version_number, ...fields } = req.body;
  const userId = req.user.id;
  
  const verifyQuery = `
    SELECT af.id 
    FROM assessment_files af
    JOIN assessments a ON af.assessment_id = a.id
    JOIN subjects s ON a.subject_id = s.id
    WHERE af.id = ? AND s.user_id = ?
  `;
  
  db.get(verifyQuery, [fileId, userId], (err, row) => {
    if (err || !row) return res.status(403).json({ error: 'Archivo no encontrado o acceso denegado' });

    // No incluimos local_uri
    const allowedFields = ['assessment_id', 'file_name', 'file_type', 'cloud_url', 'file_size', 'is_backed_up'];
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

    updateWithVersionGuard('assessment_files', fileId, columns, values, incomingVersion, (err, changes) => {
      if (err) return res.status(500).json({ error: err.message });
      if (changes === 0) return respondStaleVersion(res, 'assessment_files', fileId);
      incrementSyncVersion('assessment_files', fileId, () => { res.json({ success: true, changes }); });
    });
  });
};

/**
 * Obtener archivos de una evaluación
 */
exports.getAssessmentFiles = (req, res) => {
  const { assessmentId } = req.params;
  const userId = req.user.id;

  verifyAssessmentAccess(assessmentId, userId, (err) => {
    if (err) return res.status(403).json({ error: err.message });

    db.all(
      'SELECT id, assessment_id, file_name, file_type, cloud_url, file_size, is_backed_up, created_at, updated_at, sync_version, version_number FROM assessment_files WHERE assessment_id = ? ORDER BY created_at DESC',
      [assessmentId],
      (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(files || []);
      }
    );
  });
};

/**
 * Eliminar un archivo
 */
exports.deleteAssessmentFile = (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.id;

  const verifyQuery = `
    SELECT af.id 
    FROM assessment_files af
    JOIN assessments a ON af.assessment_id = a.id
    JOIN subjects s ON a.subject_id = s.id
    WHERE af.id = ? AND s.user_id = ?
  `;

  db.get(verifyQuery, [fileId, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Archivo no encontrado o acceso denegado' });

    recordDeletion('assessment_files', fileId, userId, () => {
      incrementSyncCounterOnly(() => {
        db.run('DELETE FROM assessment_files WHERE id = ?', [fileId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Archivo eliminado' });
        });
      });
    });
  });
};
