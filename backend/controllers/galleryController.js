const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { deleteFromUploadthing } = require('../utils/uploadthingServer');
const { incrementSyncVersion, recordDeletion } = require('../helpers/syncVersion');

/**
 * Obtener todos los ítems de la galería de un usuario
 */
exports.getGalleryItems = (req, res) => {
  const { userId } = req.params;
  const authenticatedUserId = req.user.id;
  
  if (String(userId) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

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
  const { id: clientId, user_id, uri, subject, date, time, ocr_text } = req.body;
  const authenticatedUserId = req.user.id;
  
  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const itemId = clientId || uuidv4();
  const query = `INSERT INTO gallery_items (id, user_id, uri, subject, date, time, ocr_text) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [itemId, user_id, uri, subject, date, time, ocr_text], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: itemId, message: 'Ítem agregado a galería' });
  });
};

/**
 * Obtener todas las fotos de una materia
 */
exports.getPhotosBySubject = (req, res) => {
  const { subjectId } = req.params;
  const userId = req.user.id;
  db.all(`SELECT p.* FROM photos p JOIN subjects s ON p.subject_id = s.id WHERE p.subject_id = ? AND s.user_id = ? ORDER BY p.created_at DESC`, [subjectId, userId], (err, rows) => {
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
  const userId = req.user.id;

  if (!tag || tag.trim().length === 0) {
    return res.status(400).json({ error: 'Se requiere un tag para buscar' });
  }

  // Buscar fotos que contengan el tag en su JSON array de tags
  const query = `
    SELECT p.* FROM photos p
    JOIN subjects s ON p.subject_id = s.id
    WHERE p.subject_id = ? AND s.user_id = ? AND LOWER(p.tags) LIKE ?
    ORDER BY p.created_at DESC
  `;

  const searchPattern = `%"${tag.toLowerCase()}"%`;
  db.all(query, [subjectId, userId, searchPattern], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
};

/**
 * Guarda una nueva foto de una materia.
 * Acepta ocr_text opcional para que el asistente IA tenga contexto inmediato.
 * Acepta group_id opcional para agrupar múltiples fotos tomadas en la misma sesión.
 * Genera automáticamente tags/palabras clave a partir del OCR para búsqueda.
 */
exports.savePhoto = (req, res) => {
  const { id: clientId, subject_id, local_uri, es_favorita, ocr_text, group_id } = req.body;
  const userId = req.user.id;
  console.log('[Gallery] Saving photo:', { subject_id, local_uri, group_id });
  
  if (!subject_id || !local_uri) {
    return res.status(400).json({ error: 'Faltan campos requeridos (subject_id, local_uri)' });
  }

  db.get('SELECT id FROM subjects WHERE id = ? AND user_id = ?', [subject_id, userId], (err, row) => {
    if (err || !row) return res.status(400).json({ error: 'Materia no encontrada o acceso denegado' });

    const photoId = clientId || uuidv4();
    const query = `
      INSERT INTO photos (id, subject_id, local_uri, es_favorita, ocr_text, tags, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Generar tags a partir del OCR si existe
    let tags = null;
    if (ocr_text && ocr_text.trim().length > 0) {
      tags = generateTagsFromOCR(ocr_text);
    }

    db.run(query, [photoId, subject_id, local_uri, es_favorita ? 1 : 0, ocr_text || null, tags, group_id || null], function(err) {
      if (err) {
        console.error('[Gallery] Save error:', err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log('[Gallery] Photo saved with ID:', photoId);
      incrementSyncVersion('photos', photoId, () => {
        res.status(201).json({
          id: photoId,
          subject_id,
          local_uri,
          es_favorita: es_favorita || 0,
          ocr_text: ocr_text || null,
          tags: tags,
          group_id: group_id || null,
          message: 'Foto registrada en BD'
        });
      });
    });
  });
};


/**
 * Marca o desmarca una foto como favorita
 */
exports.toggleFavoritePhoto = (req, res) => {
  const { photoId } = req.params;
  const { es_favorita } = req.body;
  const userId = req.user.id;

  db.run(
    `UPDATE photos SET es_favorita = ? WHERE id = ? AND subject_id IN (SELECT id FROM subjects WHERE user_id = ?)`,
    [es_favorita ? 1 : 0, photoId, userId],
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
  const userId = req.user.id;

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

  updateValues.push(photoId, userId);
  const query = `UPDATE photos SET ${updateFields.join(', ')} WHERE id = ? AND subject_id IN (SELECT id FROM subjects WHERE user_id = ?)`;

  db.run(query, updateValues, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    incrementSyncVersion('photos', photoId, () => {
      res.json({ success: true, changes: this.changes });
    });
  });
};

/**
 * Elimina una foto
 */
exports.deletePhoto = (req, res) => {
  const { photoId } = req.params;
  const userId = req.user.id;
  console.log(`[Backend] DELETE /photos/${photoId} recibido.`);

  db.get(`SELECT p.local_uri FROM photos p JOIN subjects s ON p.subject_id = s.id WHERE p.id = ? AND s.user_id = ?`, [photoId, userId], async (err, row) => {
    if (err) {
      console.error('[Backend] Error en db.get (photos):', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      console.log(`[Backend] La foto ${photoId} no existe en la BD. Respondiendo éxito para limpieza.`);
      return res.json({ success: true, message: 'La foto ya no existía en la base de datos.' });
    }

    console.log(`[Backend] Foto ${photoId} encontrada. Procediendo a borrar de la BD.`);
    db.run(`DELETE FROM photos WHERE id = ? AND subject_id IN (SELECT id FROM subjects WHERE user_id = ?)`, [photoId, userId], async function (deleteErr) {
      if (deleteErr) {
        console.error('[Backend] Error en db.run (DELETE photos):', deleteErr.message);
        return res.status(500).json({ error: deleteErr.message });
      }

      console.log(`[Backend] Foto ${photoId} borrada de la BD con éxito.`);
      recordDeletion('photos', photoId, userId, () => {
        res.json({ success: true, local_uri: row.local_uri });
      });
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
