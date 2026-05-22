const { db } = require('../db');
const gradingEngine = require('../services/gradingEngine');

/**
 * Obtener una materia específica por su ID
 */
exports.getSubjectById = (req, res) => {
  const { subjectId } = req.params;
  const query = `
    SELECT s.*,
    COALESCE((
      SELECT 
        CASE 
          WHEN SUM(CAST(REPLACE(COALESCE(a.weight, '0'), '%', '') AS REAL)) > 0 
          THEN 
            SUM(
              ar.normalized_value
              * (CAST(REPLACE(COALESCE(a.weight, '0'), '%', '') AS REAL) / 100.0)
            ) / (
              SUM(CAST(REPLACE(COALESCE(a.weight, '0'), '%', '') AS REAL)) / 100.0
            )
          WHEN COUNT(ar.id) > 0
          THEN
            AVG(ar.normalized_value)
          ELSE 0 
        END
      FROM assessments a
      LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
      WHERE a.subject_id = s.id
    ), 0) AS normalized_avg_score,
    COALESCE((
      SELECT SUM(CAST(REPLACE(COALESCE(a.weight, '0'), '%', '') AS REAL))
      FROM assessments a
      WHERE a.subject_id = s.id
    ), 0) AS completion_percent
    FROM subjects s WHERE id = ?
  `;
  db.get(query, [subjectId], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Materia no encontrada' });

    try {
      // Find the user's active version to denormalize
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT active_grading_version_id FROM users WHERE id = ?', [row.user_id], (err, u) => {
          if (err) return reject(err);
          resolve(u);
        });
      });

      if (user && user.active_grading_version_id) {
        // Obtenemos la version activa
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
          row.avg_score = gradingEngine.denormalizeGrade(row.normalized_avg_score, versionRow);
          const eq = gradingEngine.getEquivalencies(row.normalized_avg_score, scales, versionRow.mode);
          if (eq) {
            row.display_label = eq.display_short_label || eq.label;
            row.display_color = eq.color;
            row.gpa_equivalent = eq.gpa_equivalent;
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
          LEFT JOIN assessment_results ar ON a.id = ar.assessment_id
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
      });

      // Find the user's active version to denormalize
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
            row.avg_score = gradingEngine.denormalizeGrade(row.normalized_avg_score, versionRow);
            const eq = gradingEngine.getEquivalencies(row.normalized_avg_score, scales, versionRow.mode);
            if (eq) {
              row.display_label = eq.display_short_label || eq.label;
              row.display_color = eq.color;
              row.gpa_equivalent = eq.gpa_equivalent;
            }
          });
        }
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
  const { user_id, code, name, credits, professor, color, icon, target_grade } = req.body;
  if (!user_id || !name) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, name)' });
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

  const query = `
    INSERT INTO subjects (user_id, code, name, credits, professor, color, icon, target_grade)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    query,
    [
      user_id,
      normalizedCode,
      name,
      credits || null,
      professor || null,
      color || '#CCCCCC',
      icon || 'book-outline',
      target_grade || null,
    ],
    function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      id: this.lastID,
      user_id,
      code: normalizedCode,
      name,
      credits: credits || null,
      professor: professor || null,
      color: color || '#CCCCCC',
      icon: icon || 'book-outline',
      target_grade: target_grade || null,
      avg_score: 0,
      completion_percent: 0,
      message: 'Materia creada',
    });
  });
};

/**
 * Elimina una materia y sus elementos
 */
exports.deleteSubject = (req, res) => {
  const { subjectId } = req.params;
  
  db.serialize(() => {
    db.run(`DELETE FROM assessments WHERE subject_id = ?`, [subjectId]);
    db.run(`DELETE FROM schedules WHERE subject_id = ?`, [subjectId]);
    db.run(`DELETE FROM photos WHERE subject_id = ?`, [subjectId]);
    db.run(`DELETE FROM scanned_documents WHERE subject_id = ?`, [subjectId]);
    db.run(`DELETE FROM audio_recordings WHERE subject_id = ?`, [subjectId]);
    db.run(`DELETE FROM youtube_videos WHERE subject_id = ?`, [subjectId]);
    db.run(`DELETE FROM flashcard_decks WHERE subject_id = ?`, [subjectId]);
    
    db.run(`DELETE FROM subjects WHERE id = ?`, [subjectId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Materia y elementos asociados eliminados correctamente' });
    });
  });
};

/**
 * Actualizar una materia
 */
exports.updateSubject = (req, res) => {
  const { subjectId } = req.params;
  const fields = req.body;
  
  const allowedFields = ['code', 'name', 'credits', 'professor', 'color', 'icon', 'target_grade'];
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

  const columns = Object.keys(fieldsToUpdate).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(fieldsToUpdate), subjectId];

  const query = `UPDATE subjects SET ${columns} WHERE id = ?`;

  db.run(query, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json({ success: true, message: 'Materia actualizada' });
  });
};
