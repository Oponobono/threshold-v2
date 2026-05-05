const { db } = require('../db');

/**
 * Obtener evaluaciones por materia
 */
exports.getAssessmentsBySubject = (req, res) => {
  const { subjectId } = req.params;
  db.all(`SELECT * FROM assessments WHERE subject_id = ?`, [subjectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Obtener todas las evaluaciones de un usuario
 */
exports.getAssessmentsByUser = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT a.*, s.name as subject_name, s.color as subject_color, s.icon as subject_icon
    FROM assessments a
    JOIN subjects s ON a.subject_id = s.id
    WHERE s.user_id = ?
    ORDER BY a.date ASC
  `;
  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Agregar una nueva evaluación a una materia
 */
exports.createAssessment = (req, res) => {
  const { subject_id, name, type, date, weight, out_of, score, percentage, grade_value, is_completed } = req.body;

  const query = `
    INSERT INTO assessments (subject_id, name, type, date, weight, out_of, score, percentage, grade_value, is_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(
    query,
    [subject_id, name, type, date, weight, out_of, score, percentage ?? null, grade_value ?? null, is_completed ? 1 : 0],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Evaluación agregada' });
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
