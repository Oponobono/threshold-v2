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
  const { subject_id, name, type, date, weight, out_of, score, percentage, grade_value, is_completed, category_id } = req.body;
  console.log('[AssessmentsController] createAssessment payload:', req.body);

  // Si se envía grade_value sin out_of, asumir escala 0-5
  const finalOutOf = out_of || (grade_value != null ? 5 : null);
  console.log('[AssessmentsController] finalOutOf:', finalOutOf);

  const query = `
    INSERT INTO assessments (subject_id, name, type, date, weight, out_of, is_completed, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(
    query,
    [subject_id, name, type, date, weight, finalOutOf, is_completed ? 1 : 0, category_id || null],
    function(err) {
      if (err) {
        console.error('[AssessmentsController] Error insertando assessment:', err.message);
        return res.status(500).json({ error: err.message });
      }
      const newAssessmentId = this.lastID;
      console.log('[AssessmentsController] Assessment creado con ID:', newAssessmentId);
      // Fase 1 & 2: Dual Write en assessment_results
      db.get('SELECT user_id FROM subjects WHERE id = ?', [subject_id], (err, subject) => {
        if (err || !subject) {
          console.log('[AssessmentsController] Error/No Subject en dual write:', err || 'No subject');
          return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada (sin notas adicionales)' });
        }
        
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [subject.user_id], (err, user) => {
          const gradingVersionId = user?.active_grading_version_id || 3; // Fallback to 3 (0-5.0 scale)
          
          db.get(`
            SELECT gv.id, gv.min_value, gv.max_value, gv.passing_value, gv.precision, gs.direction 
            FROM grading_versions gv JOIN grading_systems gs ON gv.grading_system_id = gs.id 
            WHERE gv.id = ?
          `, [gradingVersionId], (err, version) => {
            if (err || !version) {
              console.log('[AssessmentsController] Error recuperando version details:', err || 'No version');
              return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada (versión no encontrada)' });
            }
            
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
              console.log(`[AssessmentsController] Insertando assessment_results: raw=${rawValue}, normalized=${normalized}`);
              db.run(`
                INSERT INTO assessment_results (assessment_id, user_id, raw_value, normalized_value, grading_version_id)
                VALUES (?, ?, ?, ?, ?)
              `, [newAssessmentId, subject.user_id, rawValue, normalized, gradingVersionId], (err) => {
                if (err) console.error('[AssessmentsController] Error insertando assessment_results:', err.message);
                else console.log('[AssessmentsController] assessment_results insertado correctamente.');
                return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada' });
              });
            } else {
              console.log('[AssessmentsController] No hay rawValue para insertar en assessment_results');
              return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada' });
            }
          });
        });
      });
    }
  );
};

/**
 * Actualizar una evaluación existente
 */
exports.updateAssessment = (req, res) => {
  const { id } = req.params;
  const { subject_id, name, type, date, weight, out_of, score, percentage, grade_value, is_completed, category_id } = req.body;
  console.log(`[AssessmentsController] updateAssessment ID ${id} payload:`, req.body);

  // Build dynamic UPDATE query
  const updates = [];
  const values = [];

  if (subject_id !== undefined) {
    updates.push('subject_id = ?');
    values.push(subject_id);
  }
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (type !== undefined) {
    updates.push('type = ?');
    values.push(type);
  }
  if (date !== undefined) {
    updates.push('date = ?');
    values.push(date);
  }
  if (weight !== undefined) {
    updates.push('weight = ?');
    values.push(weight);
  }
  if (out_of !== undefined) {
    updates.push('out_of = ?');
    values.push(out_of);
  }
  if (is_completed !== undefined) {
    updates.push('is_completed = ?');
    values.push(is_completed ? 1 : 0);
  }
  if (category_id !== undefined) {
    updates.push('category_id = ?');
    values.push(category_id);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);

  const query = `UPDATE assessments SET ${updates.join(', ')} WHERE id = ?`;
  console.log(`[AssessmentsController] Ejecutando: ${query} con`, values);

  db.run(query, values, function(err) {
    if (err) {
      console.error('[AssessmentsController] Error en UPDATE assessments:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ error: 'Evaluación no encontrada.' });

    // Si se actualiza grade_value o percentage, también actualizar assessment_results
    if (grade_value !== undefined || percentage !== undefined || score !== undefined) {
      console.log('[AssessmentsController] Detectado cambio en nota, iniciando dual-write');
      db.get('SELECT subject_id FROM assessments WHERE id = ?', [id], (err, assessment) => {
        if (!err && assessment) {
          db.get('SELECT user_id FROM subjects WHERE id = ?', [assessment.subject_id], (err, subject) => {
            if (!err && subject) {
              db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [subject.user_id], (err, user) => {
                const gradingVersionId = user?.active_grading_version_id || 3; // Fallback to 3 (0-5.0 scale)

                db.get(`
                  SELECT gv.id, gv.min_value, gv.max_value, gv.passing_value, gv.precision, gs.direction 
                  FROM grading_versions gv JOIN grading_systems gs ON gv.grading_system_id = gs.id 
                  WHERE gv.id = ?
                `, [gradingVersionId], (err, version) => {
                    if (!err && version) {
                      let rawValue = null;
                      if (grade_value != null) rawValue = grade_value;
                      else if (score != null && (out_of || 5) > 0) rawValue = (score / (out_of || 5)) * version.max_value;
                      else if (percentage != null) {
                        if (version.max_value === 100) rawValue = percentage;
                        else rawValue = (percentage / 100) * version.max_value;
                      }

                      if (rawValue !== null) {
                        const { normalizeGrade } = require('../services/gradingEngine');
                        const normalized = normalizeGrade(rawValue, version);
                        console.log(`[AssessmentsController] update dual-write: raw=${rawValue}, normalized=${normalized}`);
                        db.get('SELECT id FROM assessment_results WHERE assessment_id = ?', [id], (err, existingResult) => {
                          if (existingResult) {
                            db.run(`
                              UPDATE assessment_results 
                              SET raw_value = ?, normalized_value = ?, grading_version_id = ?
                              WHERE assessment_id = ?
                            `, [rawValue, normalized, gradingVersionId, id], (err) => {
                              if(err) console.error('[AssessmentsController] Error UPDATE assessment_results:', err.message);
                              else console.log('[AssessmentsController] assessment_results actualizado');
                              return res.json({ id, message: 'Evaluación actualizada' });
                            });
                          } else {
                            db.run(`
                              INSERT INTO assessment_results (assessment_id, user_id, raw_value, normalized_value, grading_version_id)
                              VALUES (?, ?, ?, ?, ?)
                            `, [id, subject.user_id, rawValue, normalized, gradingVersionId], (err) => {
                              if(err) console.error('[AssessmentsController] Error INSERT assessment_results:', err.message);
                              else console.log('[AssessmentsController] assessment_results insertado');
                              return res.json({ id, message: 'Evaluación actualizada' });
                            });
                          }
                        });
                      } else {
                        console.log('[AssessmentsController] No hay rawValue para actualizar en assessment_results');
                        return res.json({ id, message: 'Evaluación actualizada' });
                      }
                    } else {
                      console.log('[AssessmentsController] dual-write: version not found');
                      return res.json({ id, message: 'Evaluación actualizada' });
                    }
                  });
              });
            } else {
              return res.json({ id, message: 'Evaluación actualizada' });
            }
          });
        } else {
          return res.json({ id, message: 'Evaluación actualizada' });
        }
      });
    } else {
      res.json({ id, message: 'Evaluación actualizada' });
    }
  });
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
