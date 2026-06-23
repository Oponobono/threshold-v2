const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

/**
 * Obtener una materia específica por su ID
 */
exports.getSubjectById = (req, res) => {
  const { subjectId } = req.params;
  const userId = req.user.id;
  
  // First get the subject
  db.get('SELECT * FROM subjects WHERE id = ? AND user_id = ?', [subjectId, userId], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Materia no encontrada' });

    try {
      // Fetch Categories
      const categories = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM assessment_categories WHERE subject_id = ?`, [subjectId], (err, cats) => {
          if (err) return reject(err);
          resolve(cats || []);
        });
      });

      // Fetch Assessments and Results
      const assessments = await new Promise((resolve, reject) => {
        const sql = `
          SELECT a.id, a.subject_id, a.category_id, a.weight, a.is_completed, ar.normalized_value 
          FROM assessments a
          LEFT JOIN assessment_results ar ON CAST(a.id AS TEXT) = CAST(ar.assessment_id AS TEXT)
          WHERE a.subject_id = ?
        `;
        db.all(sql, [subjectId], (err, asts) => {
          if (err) return reject(err);
          resolve(asts || []);
        });
      });

      // Normalize weights
      assessments.forEach(a => {
        let finalWeight = 0;
        if (a.weight) {
          finalWeight = parseFloat(String(a.weight).replace('%', ''));
        }
        a.weight = finalWeight;
      });

      // Calculate grade using AcademicWorkflowEngine
      const { normalized_avg_score } = AcademicWorkflowEngine.calculateSubjectGrade(categories, assessments);
      row.normalized_avg_score = normalized_avg_score || 0;

      // Calculate completion percent
      let completion = 0;
      assessments.forEach(a => {
        if (a.is_completed || (a.normalized_value !== null && a.normalized_value !== undefined)) {
          completion += parseFloat(a.weight || 0);
        }
      });
      row.completion_percent = completion;

      // Find the user's active version to denormalize
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [row.user_id], (err, u) => {
          if (err) return reject(err);
          resolve(u);
        });
      });

      if (user && user.active_grading_version_id) {
        const versionRow = await new Promise((resolve, reject) => {
          db.get(
            `SELECT gv.*, gs.direction, gs.mode, gs.code as system_code, gs.type as system_type
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
          row.avg_score = gradingEngine.denormalizeGrade(row.normalized_avg_score, versionRow);
          if (versionRow.system_type === 'letter') {
            const eq = gradingEngine.getEquivalencies(row.normalized_avg_score, scales, versionRow.mode, versionRow);
            if (eq) {
              row.display_label = eq.display_short_label || eq.label;
              row.display_color = eq.color;
              row.gpa_equivalent = eq.gpa_equivalent;
            }
          }
        }
      }
    } catch (error) {
      console.warn('[Subjects] Error denormalizing grade:', error.message);
    }

    res.json(row);
  });
};

const AcademicWorkflowEngine = require('../services/academicWorkflowEngine');
const gradingEngine = require('../services/gradingEngine');

/**
 * Obtener todas las materias de un usuario
 */
exports.getSubjectsByUser = (req, res) => {
  const { userId } = req.params;
  const query = `SELECT * FROM subjects WHERE user_id = ?`;
  
  db.all(query, [userId], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.json(rows);

    try {
      const subjectIds = rows.map(r => r.id);
      const placeholders = subjectIds.map(() => '?').join(',');

      // Fetch Categories
      const categories = await new Promise((resolve, reject) => {
        db.all(`SELECT * FROM assessment_categories WHERE subject_id IN (${placeholders})`, subjectIds, (err, cats) => {
          if (err) return reject(err);
          resolve(cats || []);
        });
      });

      // Fetch Assessments and Results
      const assessments = await new Promise((resolve, reject) => {
        const sql = `
          SELECT a.id, a.subject_id, a.category_id, a.weight, a.is_completed, ar.normalized_value 
          FROM assessments a
          LEFT JOIN assessment_results ar ON CAST(a.id AS TEXT) = CAST(ar.assessment_id AS TEXT)
          WHERE a.subject_id IN (${placeholders})
        `;
        db.all(sql, subjectIds, (err, asts) => {
          if (err) return reject(err);
          resolve(asts || []);
        });
      });

      // Group assessments by subject
      const assessmentsBySub = {};
      const categoriesBySub = {};
      subjectIds.forEach(sid => {
        assessmentsBySub[sid] = [];
        categoriesBySub[sid] = [];
      });

      categories.forEach(c => categoriesBySub[c.subject_id].push(c));
      assessments.forEach(a => {
        // Normalizar weight (remove % if present)
        let finalWeight = 0;
        if (a.weight) {
          finalWeight = parseFloat(String(a.weight).replace('%', ''));
        }
        a.weight = finalWeight;
        assessmentsBySub[a.subject_id].push(a);
      });

      // Calculate workflow engine logic per subject
      rows.forEach(row => {
        const subCats = categoriesBySub[row.id];
        const subAsts = assessmentsBySub[row.id];

        const { normalized_avg_score } = AcademicWorkflowEngine.calculateSubjectGrade(subCats, subAsts);
        row.normalized_avg_score = normalized_avg_score || 0;

        // Completion percent
        let completion = 0;
        subAsts.forEach(a => {
          if (a.is_completed || (a.normalized_value !== null && a.normalized_value !== undefined)) {
            completion += parseFloat(a.weight || 0);
          }
        });
        row.completion_percent = completion;

        // Always calculate avg_score (denormalized) - use a default scale if no active version
        // Default: assume 0-5 scale for display
        if (row.normalized_avg_score > 0) {
          row.avg_score = row.normalized_avg_score * 5; // Simple denormalization to 0-5
        } else {
          row.avg_score = 0;
        }
      });

      // Find the user's active version to denormalize (and override avg_score)
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [userId], (err, u) => {
          if (err) return reject(err);
          resolve(u);
        });
      });

      if (user && user.active_grading_version_id) {
        const versionRow = await new Promise((resolve, reject) => {
          db.get(
            `SELECT gv.*, gs.direction, gs.mode, gs.code as system_code, gs.type as system_type
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
            row.avg_score = gradingEngine.denormalizeGrade(row.normalized_avg_score, versionRow);
            if (versionRow.system_type === 'letter') {
              const eq = gradingEngine.getEquivalencies(row.normalized_avg_score, scales, versionRow.mode, versionRow);
              if (eq) {
                row.display_label = eq.display_short_label || eq.label;
                row.display_color = eq.color;
                row.gpa_equivalent = eq.gpa_equivalent;
              }
            }

            // Calcular nota proyectada y delta para consistencia con detalle
            const subAsts = assessmentsBySub[row.id] || [];
            const gradedAsts = subAsts
              .filter(a => a.normalized_value !== null && a.normalized_value !== undefined)
              .map(a => ({
                grade_value: gradingEngine.denormalizeGrade(a.normalized_value, versionRow),
                weight: a.weight || 0,
              }));
            if (gradedAsts.length > 0) {
              const proj = gradingEngine.calculateProjectedGrade(gradedAsts, 5.0);
              row.projected_grade = proj.projectedGrade;
              row.delta = proj.delta;
            } else {
              row.projected_grade = row.avg_score;
              row.delta = 0;
            }
          });
        } else {
          // Fallback sin grading version: rough estimate
          rows.forEach(row => {
            const subAsts = assessmentsBySub[row.id] || [];
            const gradedAsts = subAsts
              .filter(a => a.normalized_value !== null && a.normalized_value !== undefined)
              .map(a => a.normalized_value * 5);
            row.projected_grade = gradedAsts.length > 0
              ? parseFloat((gradedAsts.reduce((s, v) => s + v, 0) / gradedAsts.length).toFixed(2))
              : 0;
            row.delta = parseFloat((row.projected_grade - row.avg_score).toFixed(2));
          });
        }
      } else {
        // Sin versión de calificación activa: rough estimate
        rows.forEach(row => {
          const subAsts = assessmentsBySub[row.id] || [];
          const gradedAsts = subAsts
            .filter(a => a.normalized_value !== null && a.normalized_value !== undefined)
            .map(a => a.normalized_value * 5);
          row.projected_grade = gradedAsts.length > 0
            ? parseFloat((gradedAsts.reduce((s, v) => s + v, 0) / gradedAsts.length).toFixed(2))
            : 0;
          row.delta = parseFloat((row.projected_grade - row.avg_score).toFixed(2));
        });
      }
    } catch (error) {
      console.warn('[Subjects] Error denormalizing grades:', error.message);
    }

    res.json(rows);
  });
};

/**
 * Agregar una nueva materia
 */
exports.createSubject = (req, res) => {
  const { id: clientId, user_id, code, name, credits, professor, color, icon, target_grade, course_id, external_url, total_lessons, completed_lessons, next_micro_milestone } = req.body;
  const authenticatedUserId = req.user.id;

  if (!user_id || !name) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, name)' });
  }

  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const normalizedCode =
    code ||
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') ||
    'SB';

  db.get('SELECT * FROM subjects WHERE user_id = ? AND LOWER(name) = LOWER(?)', [user_id, name], (err, existingSubject) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (existingSubject) {
      // Return existing subject to prevent duplicates on offline sync retries
      return res.status(200).json({
        ...existingSubject,
        avg_score: 0,
        completion_percent: 0,
        message: 'Materia existente recuperada',
      });
    }

    const subjectId = clientId || uuidv4();
    const query = `
      INSERT INTO subjects (id, user_id, code, name, credits, professor, color, icon, target_grade, course_id, external_url, total_lessons, completed_lessons, next_micro_milestone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const proceedCreate = (validCourseId) => {
      db.run(
        query,
        [
          subjectId,
          user_id,
          normalizedCode,
          name,
          credits || null,
          professor || null,
          color || '#CCCCCC',
          icon || 'book-outline',
          target_grade || null,
          validCourseId,
          external_url || null,
          total_lessons || 0,
          completed_lessons || 0,
          next_micro_milestone || null,
        ],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({
            id: subjectId,
            user_id,
            code: normalizedCode,
            name,
            credits: credits || null,
            professor: professor || null,
            color: color || '#CCCCCC',
            icon: icon || 'book-outline',
            target_grade: target_grade || null,
            course_id: validCourseId,
            external_url: external_url || null,
            total_lessons: total_lessons || 0,
            completed_lessons: completed_lessons || 0,
            next_micro_milestone: next_micro_milestone || null,
            avg_score: 0,
            completion_percent: 0,
            message: 'Materia creada',
          });
        }
      );
    };

    if (course_id) {
      db.get('SELECT id FROM courses WHERE id = ?', [course_id], (err, row) => {
        proceedCreate(row ? course_id : null);
      });
    } else {
      proceedCreate(null);
    }
});
};

/**
 * Elimina una materia y sus elementos
 */
exports.deleteSubject = (req, res) => {
  const { subjectId } = req.params;
  const userId = req.user.id;
  
  // Verificar propiedad antes de borrar en cascada
  db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', [subjectId, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Materia no encontrada o acceso denegado' });

    const tables = ['assessments', 'schedules', 'photos', 'scanned_documents', 'audio_recordings', 'youtube_videos', 'flashcard_decks'];
    let i = 0;
    const next = () => {
      if (i < tables.length) {
        db.run(`DELETE FROM ${tables[i]} WHERE subject_id = ?`, [subjectId], () => { i++; next(); });
      } else {
        db.run(`DELETE FROM subjects WHERE id = ? AND user_id = ?`, [subjectId, userId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, message: 'Materia y elementos asociados eliminados correctamente' });
        });
      }
    };
    next();
  });
};

/**
 * Actualizar una materia
 */
exports.updateSubject = (req, res) => {
  const { subjectId } = req.params;
  const fields = req.body;
  
  const allowedFields = ['code', 'name', 'credits', 'professor', 'color', 'icon', 'target_grade', 'course_id', 'external_url', 'total_lessons', 'completed_lessons', 'next_micro_milestone'];
  const fieldsToUpdate = {};
  
  // Filtrar solo los campos permitidos
  for (const key of Object.keys(fields)) {
    if (allowedFields.includes(key)) {
      fieldsToUpdate[key] = fields[key];
    }
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos válidos para actualizar' });
  }

  const proceedUpdate = () => {
    const columns = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(fieldsToUpdate), subjectId, req.user.id];

    const query = `UPDATE subjects SET ${columns} WHERE id = ? AND user_id = ?`;

    db.run(query, values, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Materia no encontrada o acceso denegado' });
      res.json({ success: true, message: 'Materia actualizada' });
    });
  };

  if (fieldsToUpdate.course_id) {
    db.get('SELECT id FROM courses WHERE id = ?', [fieldsToUpdate.course_id], (err, row) => {
      if (err || !row) {
        fieldsToUpdate.course_id = null; // Fallback robusto si el curso no ha sincronizado o split-brain
      }
      proceedUpdate();
    });
  } else {
    proceedUpdate();
  }
};
