const { db } = require('../db');
const gradingEngine = require('../services/gradingEngine');

/**
 * Obtener evaluaciones por materia
 */
exports.getAssessmentsBySubject = (req, res) => {
  const { subjectId } = req.params;
  const query = `
    SELECT a.*, ar.normalized_value, ar.raw_value as original_raw_value, s.user_id
    FROM assessments a
    LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
    JOIN subjects s ON a.subject_id = s.id
    WHERE a.subject_id = ?
    ORDER BY a.date ASC
  `;
  db.all(query, [subjectId], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.json(rows);

    try {
      const userId = rows[0].user_id;
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [userId], (err, u) => {
          if (err) return reject(err);
          resolve(u);
        });
      });

      if (user && user.active_grading_version_id) {
        const versionRow = await new Promise((resolve, reject) => {
          db.get(
            `SELECT gv.*, gs.direction, gs.mode, gs.code as system_code 
             FROM grading_versions gv
             JOIN grading_systems gs ON gs.id = gv.grading_system_id
             WHERE gv.id = ?`,
            [user.active_grading_version_id],
            (err, v) => {
              if (err) return reject(err);
              resolve(v);
            }
          );
        });
        
        if (versionRow) {
          const scales = await gradingEngine.getScalesForVersion(versionRow.id);
          rows.forEach(row => {
            if (row.normalized_value !== null && row.normalized_value !== undefined) {
              row.score = gradingEngine.denormalizeGrade(row.normalized_value, versionRow);
              const eq = gradingEngine.getEquivalencies(row.normalized_value, scales, versionRow.mode);
              if (eq) {
                row.display_label = eq.display_short_label || eq.label;
                row.display_color = eq.color;
                row.gpa_equivalent = eq.gpa_equivalent;
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn('[Assessments] Error denormalizing grades:', error.message);
    }
    
    res.json(rows);
  });
};

/**
 * Obtener todas las evaluaciones de un usuario
 */
exports.getAssessmentsByUser = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT a.*, ar.normalized_value, ar.raw_value as original_raw_value, 
           s.name as subject_name, s.color as subject_color, s.icon as subject_icon, s.user_id
    FROM assessments a
    JOIN subjects s ON a.subject_id = s.id
    LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
    WHERE s.user_id = ?
    ORDER BY a.date ASC
  `;
  db.all(query, [userId], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.json(rows);

    try {
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [userId], (err, u) => {
          if (err) return reject(err);
          resolve(u);
        });
      });

      if (user && user.active_grading_version_id) {
        const versionRow = await new Promise((resolve, reject) => {
          db.get(
            `SELECT gv.*, gs.direction, gs.mode, gs.code as system_code 
             FROM grading_versions gv
             JOIN grading_systems gs ON gs.id = gv.grading_system_id
             WHERE gv.id = ?`,
            [user.active_grading_version_id],
            (err, v) => {
              if (err) return reject(err);
              resolve(v);
            }
          );
        });
        
        if (versionRow) {
          const scales = await gradingEngine.getScalesForVersion(versionRow.id);
          rows.forEach(row => {
            if (row.normalized_value !== null && row.normalized_value !== undefined) {
              row.score = gradingEngine.denormalizeGrade(row.normalized_value, versionRow);
              const eq = gradingEngine.getEquivalencies(row.normalized_value, scales, versionRow.mode);
              if (eq) {
                row.display_label = eq.display_short_label || eq.label;
                row.display_color = eq.color;
                row.gpa_equivalent = eq.gpa_equivalent;
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn('[Assessments] Error denormalizing grades:', error.message);
    }
    
    res.json(rows);
  });
};

/**
 * Agregar una nueva evaluación a una materia
 */
exports.createAssessment = (req, res) => {
  const { subject_id, name, type, date, weight, out_of, score, percentage, grade_value, is_completed } = req.body;

  // Si se envía grade_value sin out_of, asumir escala 0-5
  const finalOutOf = out_of || (grade_value != null ? 5 : null);

  const query = `
    INSERT INTO assessments (subject_id, name, type, date, weight, out_of, is_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(
    query,
    [subject_id, name, type, date, weight, finalOutOf, is_completed ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const newAssessmentId = this.lastID;

      // Fase 1 & 2: Dual Write en assessment_results
      db.get('SELECT user_id FROM subjects WHERE id = ?', [subject_id], (err, subject) => {
        if (!err && subject) {
          db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [subject.user_id], (err, user) => {
            if (!err && user && user.active_grading_version_id) {
              db.get(`
                SELECT gv.id, gv.min_value, gv.max_value, gv.passing_value, gv.precision, gs.direction 
                FROM grading_versions gv JOIN grading_systems gs ON gv.grading_system_id = gs.id 
                WHERE gv.id = ?
              `, [user.active_grading_version_id], (err, version) => {
                if (!err && version) {
                  let rawValue = null;
                  if (grade_value != null) rawValue = grade_value;
                  else if (score != null && out_of > 0) rawValue = (score / out_of) * version.max_value;
                  else if (percentage != null) {
                    if (version.max_value === 100) rawValue = percentage;
                    else rawValue = (percentage / 100) * version.max_value;
                  }

                  if (rawValue !== null) {
                    const { normalizeGrade } = require('../services/gradingEngine');
                    const normalized = normalizeGrade(rawValue, version);
                    db.run(`
                      INSERT INTO assessment_results (assessment_id, user_id, raw_value, normalized_value, grading_version_id)
                      VALUES (?, ?, ?, ?, ?)
                    `, [newAssessmentId, subject.user_id, rawValue, normalized, user.active_grading_version_id]);
                  }
                }
              });
            }
          });
        }
      });

      res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada' });
    }
  );
};

/**
 * Eliminar una evaluación
 */
exports.deleteAssessment = (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM assessments WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Evaluación no encontrada.' });
    res.json({ message: 'Evaluación eliminada exitosamente' });
  });
};
