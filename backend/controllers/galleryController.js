const { db } = require('../db');
const { deleteFromUploadthing } = require('../utils/uploadthingServer');

/**
 * Obtener todos los ítems de la galería de un usuario
 */
exports.getGalleryItems = (req, res) => {
  const { userId } = req.params;
  console.log('[Gallery] Fetching items for userId:', userId);
  
  // Usamos consultas separadas y unimos en JS para evitar fallos si una tabla
  // tiene una estructura ligeramente distinta (ej: columnas de backup faltantes).
  
  const photosQuery = `
    SELECT 
      p.*, 
      s.name as subject_name, 
      s.color as subject_color,
      'photo' as item_type
    FROM photos p
    JOIN subjects s ON p.subject_id = s.id
    WHERE s.user_id = ?
  `;

  const docsQuery = `
    SELECT 
      d.*, 
      s.name as subject_name, 
      s.color as subject_color,
      'document' as item_type
    FROM scanned_documents d
    LEFT JOIN subjects s ON d.subject_id = s.id
    WHERE d.user_id = ?
  `;

  db.all(photosQuery, [userId], (err, photos) => {
    if (err) {
      console.error('[Gallery] Error al obtener fotos:', err.message);
      // No cortamos la ejecución, intentamos traer documentos
    }

    db.all(docsQuery, [userId], (err2, docs) => {
      if (err2) {
        console.error('[Gallery] Error al obtener documentos:', err2.message);
      }

      const results = [...(photos || []), ...(docs || [])];
      
      // Ordenar por fecha de creación descendente
      results.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });

      console.log(`[Gallery] Retornando ${results.length} elementos combinados`);
      res.json(results);
    });
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
 * Buscar fotos por tags (palabras clave)
 * Acepta un tag y retorna todas las fotos que lo contienen
 */
exports.searchPhotosByTag = (req, res) => {
  const { subjectId } = req.params;
  const { tag } = req.query;

  if (!tag || tag.trim().length === 0) {
    return res.status(400).json({ error: 'Se requiere un tag para buscar' });
  }

  // Buscar fotos que contengan el tag en su JSON array de tags
  const query = `
    SELECT * FROM photos 
    WHERE subject_id = ? AND tags LIKE ?
    ORDER BY created_at DESC
  `;

  const searchPattern = `%"${tag.toLowerCase()}"%`;
  db.all(query, [subjectId, searchPattern], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

/**
 * Guarda una nueva foto de una materia.
 * Acepta ocr_text opcional para que el asistente IA tenga contexto inmediato.
 * Genera automáticamente tags/palabras clave a partir del OCR para búsqueda.
 */
exports.savePhoto = (req, res) => {
  const { subject_id, local_uri, es_favorita, ocr_text } = req.body;
  console.log('[Gallery] Saving photo:', { subject_id, local_uri });
  
  if (!subject_id || !local_uri) {
    return res.status(400).json({ error: 'Faltan campos requeridos (subject_id, local_uri)' });
  }

  const query = `
    INSERT INTO photos (subject_id, local_uri, es_favorita, ocr_text, tags)
    VALUES (?, ?, ?, ?, ?)
  `;

  // Generar tags a partir del OCR si existe
  let tags = null;
  if (ocr_text && ocr_text.trim().length > 0) {
    tags = generateTagsFromOCR(ocr_text);
  }

  db.run(query, [subject_id, local_uri, es_favorita || 0, ocr_text || null, tags], function(err) {
    if (err) {
      console.error('[Gallery] Save error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log('[Gallery] Photo saved with ID:', this.lastID);
    res.status(201).json({
      id: this.lastID,
      subject_id,
      local_uri,
      es_favorita: es_favorita || 0,
      ocr_text: ocr_text || null,
      tags: tags,
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
 * Actualiza una foto (ej: guardar OCR extraído posteriormente)
 * Genera automáticamente tags si se actualiza ocr_text
 */
exports.updatePhoto = (req, res) => {
  const { photoId } = req.params;
  const { ocr_text, es_favorita } = req.body;

  const updateFields = [];
  const updateValues = [];

  if (ocr_text !== undefined) {
    updateFields.push('ocr_text = ?');
    updateValues.push(ocr_text);
    
    // Generar tags automáticamente a partir del OCR
    if (ocr_text && ocr_text.trim().length > 0) {
      const tags = generateTagsFromOCR(ocr_text);
      updateFields.push('tags = ?');
      updateValues.push(tags);
    }
  }
  
  if (es_favorita !== undefined) {
    updateFields.push('es_favorita = ?');
    updateValues.push(es_favorita ? 1 : 0);
  }

  if (req.body.cloud_url !== undefined) {
    updateFields.push('cloud_url = ?');
    updateValues.push(req.body.cloud_url);
    updateFields.push('is_backed_up = 1');
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
  }

  updateValues.push(photoId);
  const query = `UPDATE photos SET ${updateFields.join(', ')} WHERE id = ?`;

  db.run(query, updateValues, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

/**
 * Elimina una foto
 */
exports.deletePhoto = (req, res) => {
  const { photoId } = req.params;
  console.log(`[Backend] DELETE /photos/${photoId} recibido.`);

  db.get(`SELECT local_uri FROM photos WHERE id = ?`, [photoId], async (err, row) => {
    if (err) {
      console.error('[Backend] Error en db.get (photos):', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      console.log(`[Backend] La foto ${photoId} no existe en la BD. Respondiendo éxito para limpieza.`);
      return res.json({ success: true, message: 'La foto ya no existía en la base de datos.' });
    }

    console.log(`[Backend] Foto ${photoId} encontrada. Procediendo a borrar de la BD.`);
    db.run(`DELETE FROM photos WHERE id = ?`, [photoId], async function (deleteErr) {
      if (deleteErr) {
        console.error('[Backend] Error en db.run (DELETE photos):', deleteErr.message);
        return res.status(500).json({ error: deleteErr.message });
      }

      console.log(`[Backend] Foto ${photoId} borrada de la BD con éxito.`);
      res.json({ success: true, local_uri: row.local_uri });
    });
  });
};

/**
 * Extrae palabras clave del texto OCR para crear tags de búsqueda
 * Usa estrategia simple: extrae sustantivos, adjetivos y verbos principales
 * Retorna JSON array string: '["tag1", "tag2", "tag3"]'
 */
function generateTagsFromOCR(ocrText) {
  if (!ocrText || ocrText.trim().length === 0) return null;

  // Palabras comunes a filtrar (stopwords)
  const stopwords = new Set([
    'el', 'la', 'los', 'las', 'de', 'que', 'y', 'a', 'en', 'es', 'se', 'lo', 'por', 'con', 'su',
    'para', 'es', 'del', 'una', 'un', 'o', 'al', 'este', 'ese', 'aquello', 'este', 'cual',
    'cuando', 'donde', 'como', 'porque', 'si', 'no', 'más', 'menos', 'muy', 'solo',
    'también', 'entre', 'hasta', 'desde', 'según', 'sin', 'sobre', 'durante', 'antes', 'después'
  ]);

  // Extraer palabras (solo alfanuméricas y espacios)
  const words = ocrText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remover puntuación
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word))
    .slice(0, 15); // Limitar a 15 tags máximo

  // Remover duplicados manteniendo orden
  const uniqueTags = [...new Set(words)];

  return JSON.stringify(uniqueTags);
}

module.exports = { ...exports, generateTagsFromOCR };
