const { db } = require('../db');

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
          WHEN SUM(
            CASE WHEN a.percentage IS NOT NULL THEN a.percentage
                 WHEN a.weight IS NOT NULL THEN CAST(REPLACE(a.weight, '%', '') AS REAL)
                 ELSE 0 END
          ) > 0 
          THEN 
            SUM(
              CASE
                WHEN a.grade_value IS NOT NULL THEN a.grade_value
                WHEN a.score IS NOT NULL AND a.out_of IS NOT NULL AND a.out_of > 0 THEN (a.score * 1.0 / a.out_of) * 5.0
                ELSE 0
              END
              * (
                CASE WHEN a.percentage IS NOT NULL THEN (a.percentage / 100.0)
                     WHEN a.weight IS NOT NULL THEN (CAST(REPLACE(a.weight, '%', '') AS REAL) / 100.0)
                     ELSE 0 END
              )
            ) / (
              SUM(
                CASE WHEN a.percentage IS NOT NULL THEN a.percentage
                     WHEN a.weight IS NOT NULL THEN CAST(REPLACE(a.weight, '%', '') AS REAL)
                     ELSE 0 END
              ) / 100.0
            )
          -- FALLBACK: If no weights are defined, calculate a simple average of existing scores
          WHEN COUNT(CASE WHEN a.grade_value IS NOT NULL OR a.score IS NOT NULL THEN 1 END) > 0
          THEN
            AVG(
              CASE
                WHEN a.grade_value IS NOT NULL THEN a.grade_value
                WHEN a.score IS NOT NULL AND a.out_of IS NOT NULL AND a.out_of > 0 THEN (a.score * 1.0 / a.out_of) * 5.0
                ELSE 0
              END
            )
          ELSE 0 
        END
      FROM assessments a
      WHERE a.subject_id = s.id AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL)
    ), 0) AS avg_score,
    COALESCE((
      SELECT SUM(
        CASE WHEN a.percentage IS NOT NULL THEN a.percentage
             WHEN a.weight IS NOT NULL THEN CAST(REPLACE(a.weight, '%', '') AS REAL)
             ELSE 0 END
      )
      FROM assessments a
      WHERE a.subject_id = s.id AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL)
    ), 0) AS completion_percent
    FROM subjects s WHERE id = ?
  `;
  db.get(query, [subjectId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json(row);
  });
};

/**
 * Obtener todas las materias de un usuario
 */
exports.getSubjectsByUser = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT s.*,
    COALESCE((
      SELECT 
        CASE 
          WHEN SUM(
            CASE WHEN a.percentage IS NOT NULL THEN a.percentage
                 WHEN a.weight IS NOT NULL THEN CAST(REPLACE(a.weight, '%', '') AS REAL)
                 ELSE 0 END
          ) > 0 
          THEN 
            SUM(
              CASE
                WHEN a.grade_value IS NOT NULL THEN a.grade_value
                WHEN a.score IS NOT NULL AND a.out_of IS NOT NULL AND a.out_of > 0 THEN (a.score * 1.0 / a.out_of) * 5.0
                ELSE 0
              END
              * (
                CASE WHEN a.percentage IS NOT NULL THEN (a.percentage / 100.0)
                     WHEN a.weight IS NOT NULL THEN (CAST(REPLACE(a.weight, '%', '') AS REAL) / 100.0)
                     ELSE 0 END
              )
            ) / (
              SUM(
                CASE WHEN a.percentage IS NOT NULL THEN a.percentage
                     WHEN a.weight IS NOT NULL THEN CAST(REPLACE(a.weight, '%', '') AS REAL)
                     ELSE 0 END
              ) / 100.0
            )
          -- FALLBACK: If no weights are defined, calculate a simple average of existing scores
          WHEN COUNT(CASE WHEN a.grade_value IS NOT NULL OR a.score IS NOT NULL THEN 1 END) > 0
          THEN
            AVG(
              CASE
                WHEN a.grade_value IS NOT NULL THEN a.grade_value
                WHEN a.score IS NOT NULL AND a.out_of IS NOT NULL AND a.out_of > 0 THEN (a.score * 1.0 / a.out_of) * 5.0
                ELSE 0
              END
            )
          ELSE 0 
        END
      FROM assessments a
      WHERE a.subject_id = s.id AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL)
    ), 0) AS avg_score,
    COALESCE((
      SELECT SUM(
        CASE WHEN a.percentage IS NOT NULL THEN a.percentage
             WHEN a.weight IS NOT NULL THEN CAST(REPLACE(a.weight, '%', '') AS REAL)
             ELSE 0 END
      )
      FROM assessments a
      WHERE a.subject_id = s.id AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL)
    ), 0) AS completion_percent
    FROM subjects s WHERE user_id = ?
  `;
  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
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
  
  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
  }

  const columns = Object.keys(fields).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(fields), subjectId];

  const query = `UPDATE subjects SET ${columns} WHERE id = ?`;

  db.run(query, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json({ success: true, message: 'Materia actualizada' });
  });
};
