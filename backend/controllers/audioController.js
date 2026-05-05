const { db } = require('../db');

/**
 * Obtener todas las grabaciones de un usuario
 */
exports.getAudioRecordings = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT ar.*, s.name as subject_name, s.color as subject_color, s.icon as subject_icon,
           at.transcript_uri, at.summary_uri
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

  const query = `
    INSERT INTO audio_recordings (user_id, subject_id, name, local_uri, duration)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(query, [user_id, subject_id || null, name || null, local_uri, duration || 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ 
      id: this.lastID, 
      user_id, 
      subject_id: subject_id || null, 
      name: name || null,
      local_uri, 
      duration: duration || 0 
    });
  });
};

/**
 * Actualizar una grabación (ej: asociar materia)
 */
exports.updateAudioRecording = (req, res) => {
  const { id } = req.params;
  const { subject_id, name } = req.body;
  
  const query = `
    UPDATE audio_recordings 
    SET subject_id = COALESCE(?, subject_id),
        name = COALESCE(?, name)
    WHERE id = ?
  `;
  
  db.run(query, [subject_id !== undefined ? subject_id : null, name !== undefined ? name : null, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

/**
 * Eliminar una grabación
 */
exports.deleteAudioRecording = (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM audio_recordings WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

/**
 * Upsert (Crear o actualizar) transcripción/resumen
 */
exports.upsertAudioTranscript = (req, res) => {
  const { recording_id, transcript_uri, summary_uri } = req.body;
  
  if (!recording_id) {
    return res.status(400).json({ error: 'Falta recording_id' });
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
      if (summary_uri !== undefined) {
        updateFields.push('summary_uri = ?');
        updateValues.push(summary_uri);
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
      const insertQuery = `
        INSERT INTO audio_transcripts (recording_id, transcript_uri, summary_uri)
        VALUES (?, ?, ?)
      `;
      db.run(insertQuery, [recording_id, transcript_uri, summary_uri], function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({ success: true, id: this.lastID, action: 'created' });
      });
    }
  });
};
