const { db } = require('../db');
const gradingEngine = require('../services/gradingEngine');

/**
 * Obtener evaluaciones por materia
 */
exports.getAssessmentsBySubject = (req, res) => {
  const { subjectId } = req.params;
  console.log(`[GET] getAssessmentsBySubject para subjectId=${subjectId}`);
  
  const query = `
    SELECT a.*, ar.normalized_value, ar.raw_value as original_raw_value, s.user_id
    FROM assessments a
    LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
    JOIN subjects s ON a.subject_id = s.id
    WHERE a.subject_id = ?
    ORDER BY a.date ASC
  `;
  db.all(query, [subjectId], async (err, rows) => {
    if (err) {
      console.error(`[GET] Error en getAssessmentsBySubject:`, err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!rows || rows.length === 0) {
      console.log(`[GET] getAssessmentsBySubject retorna vacío`);
      return res.json(rows);
    }

    console.log(`[GET] getAssessmentsBySubject encontró ${rows.length} assessments sin denormalizar`);

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
            // Normalize data types
            if (row.normalized_value !== null && row.normalized_value !== undefined) {
              row.normalized_value = parseFloat(row.normalized_value);
            }
            if (row.original_raw_value !== null && row.original_raw_value !== undefined) {
              row.grade_value = parseFloat(row.original_raw_value);
            }
            if (row.is_completed !== undefined) {
              row.is_completed = row.is_completed === 1 ? 1 : 0;
            }
            
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
          console.log(`[GET] getAssessmentsBySubject denormalizados:`, rows.map(r => ({ id: r.id, grade_value: r.grade_value, normalized_value: r.normalized_value, is_completed: r.is_completed })));
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
  console.log(`[GET] getAssessmentsByUser para userId=${userId}`);
  
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
    if (err) {
      console.error(`[GET] Error en getAssessmentsByUser:`, err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!rows || rows.length === 0) {
      console.log(`[GET] getAssessmentsByUser retorna vacío`);
      return res.json(rows);
    }

    console.log(`[GET] getAssessmentsByUser encontró ${rows.length} assessments sin denormalizar`);

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
            // Normalize data types
            if (row.normalized_value !== null && row.normalized_value !== undefined) {
              row.normalized_value = parseFloat(row.normalized_value);
            }
            if (row.original_raw_value !== null && row.original_raw_value !== undefined) {
              row.grade_value = parseFloat(row.original_raw_value);
            }
            if (row.is_completed !== undefined) {
              row.is_completed = row.is_completed === 1 ? 1 : 0;
            }
            
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
          console.log(`[GET] getAssessmentsByUser denormalizados:`, rows.map(r => ({ id: r.id, grade_value: r.grade_value, normalized_value: r.normalized_value, is_completed: r.is_completed })));
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
  console.log('[POST] 📝 createAssessment payload:', {
    subject_id, name, type, date, weight, out_of, score, percentage, grade_value, is_completed, category_id
  });

  // Si se envía grade_value sin out_of, asumir escala 0-5
  const finalOutOf = out_of || (grade_value != null ? 5 : null);
  console.log('[POST] 📊 Configuración final:', { finalOutOf, gradeValueInput: grade_value });

  const query = `
    INSERT INTO assessments (subject_id, name, type, date, weight, out_of, is_completed, category_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(
    query,
    [subject_id, name, type, date, weight, finalOutOf, is_completed ? 1 : 0, category_id || null],
    function(err) {
      if (err) {
        console.error('[POST] ❌ Error insertando assessment:', err.message);
        return res.status(500).json({ error: err.message });
      }
      const newAssessmentId = this.lastID;
      console.log('[POST] ✅ Assessment creado con ID:', newAssessmentId);
      
      // Fase 1 & 2: Dual Write en assessment_results
      db.get('SELECT user_id FROM subjects WHERE id = ?', [subject_id], (err, subject) => {
        if (err || !subject) {
          console.log('[POST] ⚠️  Error/No Subject en dual write:', err || 'No subject');
          return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada (sin notas adicionales)' });
        }
        console.log('[POST] ✅ Subject encontrado:', { subjectId: subject_id, userId: subject.user_id });
        
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [subject.user_id], (err, user) => {
          const gradingVersionId = user?.active_grading_version_id || 3; // Fallback to 3 (0-5.0 scale)
          console.log('[POST] ✅ GradingVersion obtenido:', { gradingVersionId });
          
          db.get(`
            SELECT gv.id, gv.min_value, gv.max_value, gv.passing_value, gv.precision, gs.direction 
            FROM grading_versions gv JOIN grading_systems gs ON gv.grading_system_id = gs.id 
            WHERE gv.id = ?
          `, [gradingVersionId], (err, version) => {
            if (err || !version) {
              console.log('[POST] ⚠️  Error recuperando version details:', err || 'No version');
              return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada (versión no encontrada)' });
            }
            
            console.log('[POST] ✅ Version obtenido:', { id: version.id, max_value: version.max_value, min_value: version.min_value });
            
            let rawValue = null;
            if (grade_value != null) rawValue = grade_value;
            else if (score != null && out_of > 0) rawValue = (score / out_of) * version.max_value;
            else if (percentage != null) {
              if (version.max_value === 100) rawValue = percentage;
              else rawValue = (percentage / 100) * version.max_value;
            }

            console.log('[POST] 📊 Raw value calculado:', { rawValue, gradeValueInput: grade_value, scoreInput: score, percentageInput: percentage });

            if (rawValue !== null) {
              const { normalizeGrade } = require('../services/gradingEngine');
              const normalized = normalizeGrade(rawValue, version);
              console.log(`[POST] 📊 Normalización: raw=${rawValue}, normalized=${normalized}, maxValue=${version.max_value}`);
              
              db.run(`
                INSERT INTO assessment_results (assessment_id, user_id, raw_value, normalized_value, grading_version_id)
                VALUES (?, ?, ?, ?, ?)
              `, [newAssessmentId, subject.user_id, rawValue, normalized, gradingVersionId], (err) => {
                if (err) {
                  console.error('[POST] ❌ Error insertando assessment_results:', err.message);
                } else {
                  console.log('[POST] ✅ assessment_results insertado correctamente:', { assessmentId: newAssessmentId, raw_value: rawValue, normalized_value: normalized });
                }
                return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada' });
              });
            } else {
              console.log('[POST] ⚠️  No hay rawValue para insertar en assessment_results');
              return res.status(201).json({ id: newAssessmentId, message: 'Evaluación agregada' });
            }
          });
        });
      });
    }
  );
};

/**
 * Helper function to fetch and denormalize a single assessment
 */
const fetchAndDenormalizeAssessment = async (assessmentId, userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT a.*, ar.normalized_value, ar.raw_value as original_raw_value, s.user_id
      FROM assessments a
      LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.id = ? AND s.user_id = ?
    `;
    db.get(query, [assessmentId, userId], async (err, row) => {
      if (err) {
        console.error('[fetchAndDenormalizeAssessment] Query error:', err.message);
        return reject(err);
      }
      if (!row) {
        console.error('[fetchAndDenormalizeAssessment] Assessment not found');
        return reject(new Error('Assessment not found'));
      }
      
      try {
        // Normalize data types
        if (row.normalized_value !== null && row.normalized_value !== undefined) {
          row.normalized_value = parseFloat(row.normalized_value);
        }
        if (row.original_raw_value !== null && row.original_raw_value !== undefined) {
          row.grade_value = parseFloat(row.original_raw_value);
        }
        // Convert SQLite integer to boolean
        if (row.is_completed !== undefined) {
          row.is_completed = row.is_completed === 1 ? 1 : 0;
        }
        
        const user = await new Promise((res, rej) => {
          db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [userId], (e, u) => {
            if (e) rej(e);
            else res(u);
          });
        });

        if (user && user.active_grading_version_id) {
          const versionRow = await new Promise((res, rej) => {
            db.get(
              `SELECT gv.*, gs.direction, gs.mode, gs.code as system_code 
               FROM grading_versions gv
               JOIN grading_systems gs ON gs.id = gv.grading_system_id
               WHERE gv.id = ?`,
              [user.active_grading_version_id],
              (e, v) => {
                if (e) rej(e);
                else res(v);
              }
            );
          });
          
          if (versionRow) {
            const scales = await gradingEngine.getScalesForVersion(versionRow.id);
            if (row.normalized_value !== null && row.normalized_value !== undefined) {
              row.score = gradingEngine.denormalizeGrade(row.normalized_value, versionRow);
              const eq = gradingEngine.getEquivalencies(row.normalized_value, scales, versionRow.mode);
              if (eq) {
                row.display_label = eq.display_short_label || eq.label;
                row.display_color = eq.color;
                row.gpa_equivalent = eq.gpa_equivalent;
              }
            }
          }
        }
        console.log('[fetchAndDenormalizeAssessment] Returning assessment:', { id: row.id, grade_value: row.grade_value, normalized_value: row.normalized_value, is_completed: row.is_completed, original_raw_value: row.original_raw_value });
        resolve(row);
      } catch (error) {
        console.error('[Assessments] Error denormalizing assessment:', error.message);
        // Return row even if denormalization fails, but with normalized data types
        if (row.normalized_value !== null && row.normalized_value !== undefined) {
          row.normalized_value = parseFloat(row.normalized_value);
        }
        if (row.original_raw_value !== null && row.original_raw_value !== undefined) {
          row.grade_value = parseFloat(row.original_raw_value);
        }
        if (row.is_completed !== undefined) {
          row.is_completed = row.is_completed === 1 ? 1 : 0;
        }
        console.log('[fetchAndDenormalizeAssessment] Denormalization failed, returning raw row:', { id: row.id, grade_value: row.grade_value, normalized_value: row.normalized_value, is_completed: row.is_completed });
        resolve(row);
      }
    });
  });
};

/**
 * Actualizar una evaluación existente
 */
exports.updateAssessment = (req, res) => {
  const { id } = req.params;
  const { subject_id, name, type, date, weight, out_of, score, percentage, grade_value, is_completed, category_id } = req.body;
  console.log(`[AssessmentsController] updateAssessment ID ${id} payload:`, req.body);

  // Build dynamic UPDATE query for assessments table
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

  // Permitir actualizaciones si se envían campos para assessment_results
  const hasScoreFields = score !== undefined || percentage !== undefined || grade_value !== undefined;
  
  if (updates.length === 0 && !hasScoreFields) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  // Si hay campos de assessments, actualizar la tabla assessments
  if (updates.length > 0) {
    values.push(id);
    const query = `UPDATE assessments SET ${updates.join(', ')} WHERE id = ?`;
    console.log(`[AssessmentsController] Ejecutando UPDATE assessments:`, query, 'con', values);

    db.run(query, values, function(err) {
      if (err) {
        console.error('[AssessmentsController] Error en UPDATE assessments:', err.message);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Evaluación no encontrada.' });

      console.log('[AssessmentsController] ✅ UPDATE assessments ejecutado, changes:', this.changes);
      
      // Si también hay cambios en assessment_results, actualizarlos
      if (hasScoreFields) {
        handleAssessmentResultsUpdate(id, score, percentage, grade_value, res);
      } else {
        return res.status(200).json({ message: 'Evaluación actualizada' });
      }
    });
  } else {
    // Si SOLO hay cambios en assessment_results (sin cambios en assessments)
    handleAssessmentResultsUpdate(id, score, percentage, grade_value, res);
  }
};

/**
 * Helper para actualizar assessment_results
 */
function handleAssessmentResultsUpdate(assessmentId, score, percentage, grade_value, res) {
  (async () => {
    try {
      // Get current assessment to find userId
      const assessment = await new Promise((resolve, reject) => {
        db.get('SELECT subject_id FROM assessments WHERE id = ?', [assessmentId], (err, row) => {
          if (err || !row) reject(err || new Error('Assessment not found'));
          else resolve(row);
        });
      });

      const subject = await new Promise((resolve, reject) => {
        db.get('SELECT user_id FROM subjects WHERE id = ?', [assessment.subject_id], (err, row) => {
          if (err || !row) reject(err || new Error('Subject not found'));
          else resolve(row);
        });
      });

      console.log('[AssessmentsController] ✅ Assessment encontrado:', { assessmentId, subjectId: assessment.subject_id, userId: subject.user_id });

      const user = await new Promise((resolve, reject) => {
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [subject.user_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      const gradingVersionId = user?.active_grading_version_id || 3;
      console.log('[AssessmentsController] ✅ GradingVersion obtenido:', { gradingVersionId });

      const version = await new Promise((resolve, reject) => {
        db.get(`
          SELECT gv.id, gv.min_value, gv.max_value, gv.passing_value, gv.precision, gs.direction 
          FROM grading_versions gv JOIN grading_systems gs ON gv.grading_system_id = gs.id 
          WHERE gv.id = ?
        `, [gradingVersionId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      console.log('[AssessmentsController] ✅ Version obtenido:', { id: version?.id, max_value: version?.max_value });

      if (version) {
        let rawValue = null;
        if (grade_value != null) rawValue = grade_value;
        else if (score != null) rawValue = (score / 5) * version.max_value;
        else if (percentage != null) {
          if (version.max_value === 100) rawValue = percentage;
          else rawValue = (percentage / 100) * version.max_value;
        }

        console.log('[AssessmentsController] 📊 Raw value calculado:', { rawValue, gradeValue: grade_value, score, percentage });

        if (rawValue !== null) {
          const { normalizeGrade } = require('../services/gradingEngine');
          const normalized = normalizeGrade(rawValue, version);
          console.log(`[AssessmentsController] 📊 Normalización: raw=${rawValue}, normalized=${normalized}`);
          
          const existingResult = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM assessment_results WHERE assessment_id = ?', [assessmentId], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          if (existingResult) {
            console.log('[AssessmentsController] 🔄 Actualizando assessment_results existente');
            await new Promise((resolve, reject) => {
              db.run(`
                UPDATE assessment_results 
                SET raw_value = ?, normalized_value = ?, grading_version_id = ?
                WHERE assessment_id = ?
              `, [rawValue, normalized, gradingVersionId, assessmentId], (err) => {
                if (err) {
                  console.error('[AssessmentsController] ❌ Error UPDATE assessment_results:', err.message);
                  reject(err);
                } else {
                  console.log('[AssessmentsController] ✅ assessment_results actualizado:', { assessmentId, raw_value: rawValue, normalized_value: normalized });
                  resolve();
                }
              });
            });
          } else {
            console.log('[AssessmentsController] ➕ Creando nuevo assessment_results');
            await new Promise((resolve, reject) => {
              db.run(`
                INSERT INTO assessment_results (assessment_id, user_id, raw_value, normalized_value, grading_version_id)
                VALUES (?, ?, ?, ?, ?)
              `, [assessmentId, subject.user_id, rawValue, normalized, gradingVersionId], (err) => {
                if (err) {
                  console.error('[AssessmentsController] ❌ Error INSERT assessment_results:', err.message);
                  reject(err);
                } else {
                  console.log('[AssessmentsController] ✅ assessment_results creado:', { assessmentId, raw_value: rawValue, normalized_value: normalized });
                  resolve();
                }
              });
            });
          }
        }
      }

      return res.status(200).json({ message: 'Evaluación actualizada' });
    } catch (err) {
      console.error('[AssessmentsController] ❌ Error en actualización de assessment_results:', err.message);
      return res.status(500).json({ error: err.message });
    }
  })();
}

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
