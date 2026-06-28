const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { deleteMultipleFromUploadthing } = require('../utils/uploadthingServer');

/**
 * Obtener todas las grabaciones de un usuario
 */
exports.getAudioRecordings = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT ar.*, 
           s.name as subject_name, s.color as subject_color, s.icon as subject_icon,
           at.transcript_uri, at.transcript_text, at.summary_uri, at.summary_text,
           at.cloud_url as transcript_cloud_url, at.is_backed_up as transcript_backed_up
    FROM audio_recordings ar
    LEFT JOIN subjects s ON ar.subject_id = s.id
    LEFT JOIN audio_transcripts at ON ar.id = at.recording_id
    WHERE ar.user_id = ?
    ORDER BY ar.created_at DESC
  `;
  db.all(query, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Crear una grabación
 */
exports.createAudioRecording = (req, res) => {
  const { user_id, subject_id, name, local_uri, duration } = req.body;
  if (!user_id || !local_uri) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, local_uri)' });
  }

  const authenticatedUserId = req.user.id;
  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const recordingId = req.body.id || uuidv4();
  const query = `
    INSERT INTO audio_recordings (id, user_id, subject_id, name, local_uri, duration)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.run(query, [recordingId, user_id, subject_id || null, name || null, local_uri, duration || 0], function(err) {
    if (err) {
      // Handle duplicate ID gracefully (idempotent create from offline sync)
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(200).json({ id: recordingId, already_exists: true });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ 
      id: recordingId, 
      user_id, 
      subject_id: subject_id || null, 
      name: name || null,
      local_uri, 
      duration: duration || 0 
    });
  });
};

/**
 * Verificar si una grabación existe (usado por el cliente antes de sincronizar transcripts)
 */
exports.checkRecordingExists = (req, res) => {
  const { id } = req.params;
  // No user_id filter: this is an existence check for FK integrity
  // (transcripts need to know if the parent recording is on the server,
  // regardless of whether the user_id was recently updated in Supabase).
  db.get(`SELECT id FROM audio_recordings WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ exists: false });
    return res.status(200).json({ exists: true, id: row.id });
  });
};

/**
 * Actualizar una grabación (ej: asociar materia)
 */
exports.updateAudioRecording = (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const userId = req.user.id;

  const allowed = ['subject_id', 'name', 'cloud_url', 'is_backed_up', 'duration'];
  const toUpdate = {};
  for (const key of Object.keys(fields)) {
    if (allowed.includes(key)) toUpdate[key] = fields[key];
  }

  // If no recognized fields provided, treat as no-op success
  if (Object.keys(toUpdate).length === 0) {
    return res.json({ success: true, changes: 0 });
  }

  const columns = Object.keys(toUpdate).map(k => `${k} = ?`).join(', ');
  const values = [...Object.values(toUpdate), id, userId];

  db.run(
    `UPDATE audio_recordings SET ${columns} WHERE id = ? AND user_id = ?`,
    values,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      // Return 200 even if no rows matched (recording may belong to this user
      // but the user_id was just updated in Supabase — tolerate the mismatch).
      res.json({ success: true, changes: this.changes });
    }
  );
};

/**
 * Eliminar una grabación
 */
exports.deleteAudioRecording = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Obtener cloud_url del audio y de su transcripción antes de eliminar
  db.get(
    `SELECT ar.cloud_url as audio_url, at.cloud_url as transcript_url
     FROM audio_recordings ar
     LEFT JOIN audio_transcripts at ON at.recording_id = ar.id
     WHERE ar.id = ? AND ar.user_id = ?`,
    [id, userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) {
        return res.json({ success: true, message: 'La grabación ya no existía.' });
      }
      db.run(`DELETE FROM audio_recordings WHERE id = ? AND user_id = ?`, [id, userId], function (deleteErr) {
        if (deleteErr) return res.status(500).json({ error: deleteErr.message });

        // Eliminar de Uploadthing en background (el CASCADE borra audio_transcripts de la BD)
        if (row) {
          const urls = [row.audio_url, row.transcript_url].filter(Boolean);
          if (urls.length > 0) deleteMultipleFromUploadthing(urls).catch(() => {});
        }

        res.json({ success: true, changes: this.changes });
      });
    }
  );
};

/**
 * Upsert (Crear o actualizar) transcripción/resumen
 */
exports.upsertAudioTranscript = (req, res) => {
  // Acepta transcript_text (texto inline) además de las URIs de archivo
  const { id: clientId, recording_id, transcript_uri, transcript_text, summary_uri, summary_text } = req.body;
  
  if (!recording_id) {
    return res.status(400).json({ error: 'Falta recording_id' });
  }

  // Verify the recording exists on the server before inserting the transcript.
  // If not, return 409 Conflict so the client knows to defer and retry.
  db.get(`SELECT id FROM audio_recordings WHERE id = ?`, [recording_id], (checkErr, recordingRow) => {
    if (checkErr) return res.status(500).json({ error: checkErr.message });
    if (!recordingRow) {
      return res.status(409).json({ 
        error: 'Grabación padre no encontrada en el servidor. Sincroniza la grabación primero.',
        code: 'PARENT_NOT_SYNCED'
      });
    }

  db.get(`SELECT id FROM audio_transcripts WHERE recording_id = ?`, [recording_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });

    if (row) {
      let updateFields = [];
      let updateValues = [];
      
      if (transcript_uri !== undefined) {
        updateFields.push('transcript_uri = ?');
        updateValues.push(transcript_uri);
      }
      // Guardar el texto de transcripción inline para acceso rápido por la IA
      if (transcript_text !== undefined) {
        updateFields.push('transcript_text = ?');
        updateValues.push(transcript_text);
      }
      if (summary_uri !== undefined) {
        updateFields.push('summary_uri = ?');
        updateValues.push(summary_uri);
      }
      if (summary_text !== undefined) {
        updateFields.push('summary_text = ?');
        updateValues.push(summary_text);
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
      }
      
      updateValues.push(recording_id);
      const updateQuery = `UPDATE audio_transcripts SET ${updateFields.join(', ')} WHERE recording_id = ?`;
      
      db.run(updateQuery, updateValues, function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ success: true, id: row.id, action: 'updated' });
      });
    } else {
      const transcriptId = clientId || uuidv4();
      const insertQuery = `
        INSERT INTO audio_transcripts (id, recording_id, transcript_uri, transcript_text, summary_uri, summary_text)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.run(insertQuery, [transcriptId, recording_id, transcript_uri, transcript_text || null, summary_uri, summary_text || null], function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({ success: true, id: transcriptId, action: 'created' });
      });
    }
  });
});
};
