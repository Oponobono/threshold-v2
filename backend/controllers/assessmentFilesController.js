const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

/**
 * Subir un archivo a una evaluación
 */
exports.uploadAssessmentFile = (req, res) => {
  const { assessmentId } = req.params;
  const userId = req.user.id;
  const { file_name, file_type, local_uri, file_size, cloud_url } = req.body;

  if (!assessmentId || !file_name) {
    return res.status(400).json({ error: 'assessmentId y file_name son requeridos' });
  }

  // Verificar que el assessment pertenece al usuario
  db.get(
    'SELECT id FROM assessments WHERE id = ? AND user_id = ?',
    [assessmentId, userId],
    (err, assessment) => {
      if (err || !assessment) {
        return res.status(403).json({ error: 'Assessment no encontrado o acceso denegado' });
      }

      const fileId = req.body.id || uuidv4();
      const query = `
        INSERT INTO assessment_files (id, assessment_id, file_name, file_type, local_uri, file_size, cloud_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          cloud_url = COALESCE(EXCLUDED.cloud_url, assessment_files.cloud_url),
          is_backed_up = CASE WHEN EXCLUDED.cloud_url IS NOT NULL THEN 1 ELSE assessment_files.is_backed_up END
      `;

      db.run(
        query,
        [fileId, assessmentId, file_name, file_type || null, local_uri || null, file_size || null, cloud_url || null],
        function(err) {
          if (err) {
            console.error('[POST] Error subiendo archivo:', err.message);
            return res.status(500).json({ error: err.message });
          }

          res.status(201).json({
            id: fileId,
            assessment_id: assessmentId,
            file_name,
            file_type,
            local_uri,
            cloud_url: cloud_url || null,
            file_size,
            is_backed_up: cloud_url ? 1 : 0,
            created_at: new Date().toISOString()
          });
        }
      );
    }
  );
};

/**
 * Obtener archivos de una evaluación
 */
exports.getAssessmentFiles = (req, res) => {
  const { assessmentId } = req.params;
  const userId = req.user.id;

  if (!assessmentId) {
    return res.status(400).json({ error: 'assessmentId es requerido' });
  }

  // Verificar que el assessment pertenece al usuario
  db.get(
    'SELECT id FROM assessments WHERE id = ? AND user_id = ?',
    [assessmentId, userId],
    (err, assessment) => {
      if (err || !assessment) {
        return res.status(403).json({ error: 'Assessment no encontrado o acceso denegado' });
      }

      db.all(
        'SELECT * FROM assessment_files WHERE assessment_id = ? ORDER BY created_at DESC',
        [assessmentId],
        (err, files) => {
          if (err) {
            console.error('[GET] Error obteniendo archivos:', err.message);
            return res.status(500).json({ error: err.message });
          }

          res.json(files || []);
        }
      );
    }
  );
};

/**
 * Eliminar un archivo de una evaluación
 */
exports.deleteAssessmentFile = (req, res) => {
  const { assessmentId, fileId } = req.params;
  const userId = req.user.id;

  if (!assessmentId || !fileId) {
    return res.status(400).json({ error: 'assessmentId y fileId son requeridos' });
  }

  // Verificar que el assessment pertenece al usuario
  db.get(
    'SELECT id FROM assessments WHERE id = ? AND user_id = ?',
    [assessmentId, userId],
    (err, assessment) => {
      if (err || !assessment) {
        return res.status(403).json({ error: 'Assessment no encontrado o acceso denegado' });
      }

      // Verificar que el archivo pertenece al assessment
      db.get(
        'SELECT id FROM assessment_files WHERE id = ? AND assessment_id = ?',
        [fileId, assessmentId],
        (err, file) => {
          if (err || !file) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
          }

          db.run(
            'DELETE FROM assessment_files WHERE id = ? AND assessment_id = ?',
            [fileId, assessmentId],
            (err) => {
              if (err) {
                console.error('[DELETE] Error eliminando archivo:', err.message);
                return res.status(500).json({ error: err.message });
              }

              res.json({ message: 'Archivo eliminado' });
            }
          );
        }
      );
    }
  );
};
