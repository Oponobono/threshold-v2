const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

// GET /api/subjects/:subjectId/categories
exports.getCategoriesBySubject = (req, res) => {
  const { subjectId } = req.params;
  const query = 'SELECT * FROM assessment_categories WHERE subject_id = ?';
  db.all(query, [subjectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

// POST /api/subjects/:subjectId/categories
exports.createCategory = (req, res) => {
  const { subjectId } = req.params;
  const { id: clientId, name, weight, drop_lowest } = req.body;
  if (!name) return res.status(400).json({ error: 'Faltan campos requeridos (name)' });

  const categoryId = clientId || uuidv4();
  const query = `
    INSERT INTO assessment_categories (id, subject_id, name, weight, drop_lowest)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(query, [categoryId, subjectId, name, weight || null, drop_lowest ? 1 : 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: categoryId, subject_id: Number(subjectId), name, weight: weight || null, drop_lowest: drop_lowest || 0 });
  });
};

// PUT /api/categories/:id
exports.updateCategory = (req, res) => {
  const { id } = req.params;
  const { name, weight, drop_lowest } = req.body;
  const query = `
    UPDATE assessment_categories
    SET name = ?, weight = ?, drop_lowest = ?
    WHERE id = ?
  `;
  db.run(query, [name, weight || null, drop_lowest ? 1 : 0, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría actualizada con éxito' });
  });
};

// DELETE /api/categories/:id
exports.deleteCategory = (req, res) => {
  const { id } = req.params;
  // Cuando se elimina una categoría, las evaluaciones quedan "uncategorized"
  db.run(`UPDATE assessments SET category_id = NULL WHERE category_id = ?`, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM assessment_categories WHERE id = ?`, [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
      res.json({ message: 'Categoría eliminada' });
    });
  });
};
