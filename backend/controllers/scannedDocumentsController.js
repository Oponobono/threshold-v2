const { v4: uuidv4 } = require('uuid');
const secrets = require('../config/secrets');
const { db } = require('../db');
const pdfParse = require('pdf-parse');
const { deleteFromUploadthing } = require('../utils/uploadthingServer');
const { incrementSyncVersion, recordDeletion } = require('../helpers/syncVersion');

/**
 * Obtener documentos escaneados por materia
 */
exports.getScannedDocumentsBySubject = async (req, res) => {
  const { subjectId } = req.params;
  try {
    const dateLimit = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const sqlDateLimit = dateLimit.toISOString().replace('T', ' ').substring(0, 19);

    // Limpiar textos viejos
    await new Promise((resolve) => {
      db.run(
        `UPDATE scanned_documents SET ocr_text = NULL WHERE subject_id = ? AND extracted_at < ?`,
        [subjectId, sqlDateLimit],
        () => resolve()
      );
    });

    db.all(
      `SELECT * FROM scanned_documents WHERE subject_id = ? ORDER BY created_at DESC`,
      [subjectId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Guardar un nuevo documento escaneado
 */
exports.saveScannedDocument = (req, res) => {
  // Acepta ocr_text para persistirlo junto al documento y hacer el contexto IA disponible de inmediato
  const { id: clientId, user_id, subject_id, name, local_uri, ocr_text } = req.body;
  
  if (!user_id || !local_uri) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, local_uri)' });
  }

  const authenticatedUserId = req.user.id;
  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const docId = clientId || uuidv4();
  const hasOcr = ocr_text && ocr_text.trim().length > 0;
  const query = hasOcr ? `
    INSERT INTO scanned_documents (id, user_id, subject_id, name, local_uri, ocr_text, extracted_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ` : `
    INSERT INTO scanned_documents (id, user_id, subject_id, name, local_uri, ocr_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const values = [docId, user_id, subject_id || null, name || null, local_uri, ocr_text || null];
  db.run(query, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    incrementSyncVersion('scanned_documents', docId, () => {
      res.status(201).json({
        id: docId,
        user_id,
        subject_id,
        name,
        local_uri,
        ocr_text: ocr_text || null,
        message: 'Documento escaneado registrado en BD'
      });
    });
  });
};

/**
 * Eliminar un documento escaneado
 */
exports.deleteScannedDocument = (req, res) => {
  const { documentId } = req.params;
  const userId = req.user.id;
  console.log(`[Backend] DELETE /scanned-documents/${documentId} recibido.`);

  db.get(`SELECT * FROM scanned_documents WHERE id = ? AND user_id = ?`, [documentId, userId], (err, row) => {
    if (err) {
      console.error('[Backend] Error en db.get (scanned_documents):', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      console.log(`[Backend] Documento ${documentId} no encontrado. Respondiendo éxito.`);
      return res.json({ success: true, message: 'El documento ya no existía.' });
    }

    console.log(`[Backend] Documento ${documentId} encontrado. Borrando de la BD.`);
    db.run(`DELETE FROM scanned_documents WHERE id = ? AND user_id = ?`, [documentId, userId], function (deleteErr) {
      if (deleteErr) {
        console.error('[Backend] Error en db.run (DELETE scanned_documents):', deleteErr.message);
        return res.status(500).json({ error: deleteErr.message });
      }

      console.log(`[Backend] Documento ${documentId} borrado de la BD.`);
      // Eliminar de Uploadthing en background
      if (row.cloud_url) {
        console.log(`[Backend] Intentando borrar de Uploadthing: ${row.cloud_url}`);
        deleteFromUploadthing(row.cloud_url).catch((utErr) => {
           console.warn('[Backend] Error (ignorado) al borrar de Uploadthing:', utErr.message);
        });
      }

      recordDeletion('scanned_documents', documentId, userId, () => {
        res.json({ success: true, local_uri: row.local_uri });
      });
    });
  });
};

/**
 * Actualizar un documento escaneado (ej. agregar ocr_text después de una extracción manual)
 */
exports.updateScannedDocument = (req, res) => {
  const { documentId } = req.params;
  const { name, ocr_text, cloud_url, is_backed_up, subject_id, mime_type } = req.body;
  const userId = req.user.id;

  if (!documentId) {
    return res.status(400).json({ error: 'ID de documento requerido' });
  }

  // Construir dinámicamente el query según qué campos se proporcionen
  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (cloud_url !== undefined) {
    updates.push('cloud_url = ?');
    values.push(cloud_url);
  }
  if (is_backed_up !== undefined) {
    updates.push('is_backed_up = ?');
    values.push(is_backed_up);
  }
  if (subject_id !== undefined) {
    updates.push('subject_id = ?');
    values.push(subject_id);
  }
  if (mime_type !== undefined) {
    // Only push if mime_type exists in schema, otherwise ignore or push dynamically.
    // We added mime_type in mobile, but if backend doesn't have it, this might crash Postgres.
    // But backend schema for SQLite might not have it yet. Let's just allow it for now if we add it to schema.
    updates.push('mime_type = ?');
    values.push(mime_type);
  }
  if (ocr_text !== undefined) {
    updates.push('ocr_text = ?');
    values.push(ocr_text);
    if (ocr_text) {
      updates.push('extracted_at = CURRENT_TIMESTAMP');
    } else {
      updates.push('extracted_at = NULL');
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  values.push(documentId, userId); // Para el WHERE clause

  const query = `UPDATE scanned_documents SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;

  db.run(query, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Documento no encontrado' });

    // Retornar el documento actualizado
    db.get(`SELECT * FROM scanned_documents WHERE id = ?`, [documentId], (getErr, row) => {
      if (getErr) return res.status(500).json({ error: getErr.message });
      incrementSyncVersion('scanned_documents', documentId, () => {
        res.json(row);
      });
    });
  });
};

/**
 * Extraer texto OCR de una imagen base64 usando Groq Vision
 */
exports.performOCR = async (req, res) => {
  const { base64Image } = req.body;
  if (!base64Image) {
    return res.status(400).json({ error: 'Falta base64Image en el body' });
  }

  // Groq límite: 4MB por request
  const estimatedBytes = (base64Image.length * 3) / 4;
  if (estimatedBytes > 3.5 * 1024 * 1024) {
    return res.status(413).json({ error: 'La imagen es demasiado grande para OCR (máx 4MB). Prueba con el filtro B/N para reducir el tamaño.' });
  }

  const groqApiKey = secrets.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ error: 'Groq API Key no está configurada' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extrae con la mayor precisión posible TODO el texto de esta imagen. Responde ÚNICAMENTE con el texto extraído, sin preámbulos, explicaciones ni formato markdown de bloque de código.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const groqMsg = data?.error?.message || JSON.stringify(data?.error) || 'Error desconocido de Groq';
      return res.status(response.status).json({ error: groqMsg });
    }

    const extractedText = data.choices?.[0]?.message?.content || '';
    res.json({ text: extractedText });
  } catch (error) {
    res.status(500).json({ error: `Error interno al comunicarse con Groq: ${error.message}` });
  }
};

/**
 * Extraer texto nativo de un archivo PDF
 */
exports.extractPDFText = async (req, res) => {
  const { base64Pdf } = req.body;
  if (!base64Pdf) {
    return res.status(400).json({ error: 'Falta base64Pdf en el body' });
  }

  try {
    const buffer = Buffer.from(base64Pdf, 'base64');
    const data = await pdfParse(buffer);
    res.json({ text: data.text });
  } catch (error) {
    console.error('Error parseando PDF:', error);
    res.status(500).json({ error: `Error extrayendo texto del PDF: ${error.message}` });
  }
};
