const { db } = require('../db');

/**
 * Obtener todos los ítems de la galería de un usuario
 */
exports.getGalleryItems = (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT * FROM gallery_items WHERE user_id = ? ORDER BY date DESC, time DESC`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Agregar un nuevo ítem a la galería
 */
exports.addGalleryItem = (req, res) => {
  const { user_id, uri, subject, date, time, ocr_text } = req.body;
  const query = `INSERT INTO gallery_items (user_id, uri, subject, date, time, ocr_text) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(query, [user_id, uri, subject, date, time, ocr_text], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Ítem agregado a galería' });
  });
};

/**
 * Obtener todas las fotos de una materia
 */
exports.getPhotosBySubject = (req, res) => {
  const { subjectId } = req.params;
  db.all(`SELECT * FROM photos WHERE subject_id = ? ORDER BY created_at DESC`, [subjectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Guarda una nueva foto de una materia.
 * Acepta ocr_text opcional para que el asistente IA tenga contexto inmediato.
 */
exports.savePhoto = (req, res) => {
  const { subject_id, local_uri, es_favorita, ocr_text } = req.body;
  
  if (!subject_id || !local_uri) {
    return res.status(400).json({ error: 'Faltan campos requeridos (subject_id, local_uri)' });
  }

  const query = `
    INSERT INTO photos (subject_id, local_uri, es_favorita, ocr_text)
    VALUES (?, ?, ?, ?)
  `;

  db.run(query, [subject_id, local_uri, es_favorita || 0, ocr_text || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({
      id: this.lastID,
      subject_id,
      local_uri,
      es_favorita: es_favorita || 0,
      ocr_text: ocr_text || null,
      message: 'Foto registrada en BD'
    });
  });
};

/**
 * Marca o desmarca una foto como favorita
 */
exports.toggleFavoritePhoto = (req, res) => {
  const { photoId } = req.params;
  const { es_favorita } = req.body;

  db.run(
    `UPDATE photos SET es_favorita = ? WHERE id = ?`,
    [es_favorita ? 1 : 0, photoId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, changes: this.changes });
    }
  );
};

/**
 * Elimina una foto
 */
exports.deletePhoto = (req, res) => {
  const { photoId } = req.params;

  db.get(`SELECT local_uri FROM photos WHERE id = ?`, [photoId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Foto no encontrada.' });

    db.run(`DELETE FROM photos WHERE id = ?`, [photoId], function (deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });
      res.json({ success: true, local_uri: row.local_uri });
    });
  });
};
