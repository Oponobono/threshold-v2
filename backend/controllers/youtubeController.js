const secrets = require('../config/secrets');
const { db } = require('../db');

/**
 * Obtener todos los videos de YouTube de un usuario
 */
exports.getYoutubeVideos = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT 
      yv.id,
      yv.user_id,
      yv.subject_id,
      yv.youtube_url,
      yv.video_id,
      yv.title,
      yv.thumbnail_url,
      yv.duration,
      yv.created_at,
      s.name as subject_name,
      s.color as subject_color,
      s.icon as subject_icon,
      yt.transcript_uri,
      yt.transcript_text,
      yt.summary_uri,
      yt.summary_text
    FROM youtube_videos yv
    LEFT JOIN subjects s ON yv.subject_id = s.id
    LEFT JOIN youtube_transcripts yt ON yv.id = yt.video_id
    WHERE yv.user_id = ?
    ORDER BY yv.created_at DESC
  `;
  
  db.all(query, [userId], (err, videos) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(videos || []);
  });
};

/**
 * Crear un nuevo video de YouTube
 */
exports.createYoutubeVideo = (req, res) => {
  const { user_id, subject_id, youtube_url, video_id, title, thumbnail_url, duration } = req.body;
  
  if (!user_id || !youtube_url || !video_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos: user_id, youtube_url, video_id' });
  }

  const authenticatedUserId = req.user.id;
  if (parseInt(user_id) !== authenticatedUserId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const query = `
    INSERT INTO youtube_videos (user_id, subject_id, youtube_url, video_id, title, thumbnail_url, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [user_id, subject_id || null, youtube_url, video_id, title || null, thumbnail_url || null, duration || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ success: true, id: this.lastID });
  });
};

/**
 * Actualizar un video de YouTube (ej: cambiar materia, título)
 */
exports.updateYoutubeVideo = (req, res) => {
  const { id } = req.params;
  const { subject_id, title } = req.body;
  const userId = req.user.id;
  
  const updateFields = [];
  const updateValues = [];
  
  if (subject_id !== undefined) {
    updateFields.push('subject_id = ?');
    updateValues.push(subject_id);
  }
  
  if (title !== undefined) {
    updateFields.push('title = ?');
    updateValues.push(title);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }
  
  updateValues.push(id, userId);
  const query = `UPDATE youtube_videos SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
  
  db.run(query, updateValues, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Video no encontrado o acceso denegado' });
    res.json({ success: true, changes: this.changes });
  });
};

/**
 * Eliminar un video de YouTube
 */
exports.deleteYoutubeVideo = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  db.run(`DELETE FROM youtube_videos WHERE id = ? AND user_id = ?`, [id, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, changes: this.changes });
  });
};

/**
 * Obtener subtítulos de un video de YouTube usando Supadata.ai
 */
exports.getYoutubeCaptions = async (req, res) => {
  const { video_id, language = 'es' } = req.body;

  if (!video_id) {
    return res.status(400).json({ error: 'Falta video_id' });
  }

  const SUPADATA_KEY = secrets.SUPADATA_API_KEY;
  if (!SUPADATA_KEY) {
    return res.status(500).json({ error: 'SUPADATA_API_KEY no configurada en el servidor.' });
  }

  try {
    let supadataRes = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${video_id}&text=true&lang=${language}`,
      { headers: { 'x-api-key': SUPADATA_KEY, 'Content-Type': 'application/json' } }
    );

    if (!supadataRes.ok && language !== 'en') {
      supadataRes = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${video_id}&text=true&lang=en`,
        { headers: { 'x-api-key': SUPADATA_KEY, 'Content-Type': 'application/json' } }
      );
    }

    if (!supadataRes.ok) {
      supadataRes = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${video_id}&text=true`,
        { headers: { 'x-api-key': SUPADATA_KEY, 'Content-Type': 'application/json' } }
      );
    }

    if (!supadataRes.ok) {
      const errText = await supadataRes.text();
      return res.status(404).json({
        error: 'No se pudieron obtener los subtítulos de este video.',
        details: `Supadata HTTP ${supadataRes.status}: ${errText}`,
      });
    }

    const data = await supadataRes.json();

    let captions = '';
    if (typeof data.content === 'string') {
      captions = data.content.trim();
    } else if (Array.isArray(data.content)) {
      captions = data.content.map(item => item.text || '').join(' ').trim();
    } else if (Array.isArray(data.transcript)) {
      captions = data.transcript.map(item => item.text || '').join(' ').trim();
    }

    if (captions.length < 10) {
      return res.status(404).json({ error: 'Los subtítulos estaban vacíos.', details: JSON.stringify(data).substring(0, 200) });
    }

    return res.json({ captions, language: data.lang || language, source: 'supadata' });

  } catch (error) {
    return res.status(500).json({ error: 'Error interno al obtener subtítulos.', details: error.message });
  }
};

/**
 * Upsert transcripción/resumen de YouTube
 */
exports.upsertYoutubeTranscript = (req, res) => {
  const { video_id, transcript_uri, transcript_text, summary_uri, summary_text } = req.body;
  
  if (!video_id) {
    return res.status(400).json({ error: 'Falta video_id' });
  }

  const userId = req.user.id;

  // Verificar propiedad
  db.get('SELECT id FROM youtube_videos WHERE id = ? AND user_id = ?', [video_id, userId], (err, video) => {
    if (err || !video) return res.status(403).json({ error: 'Video no encontrado o acceso denegado' });

    db.get(`SELECT id FROM youtube_transcripts WHERE video_id = ?`, [video_id], (err, row) => {
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
      
      updateValues.push(video_id);
      const updateQuery = `UPDATE youtube_transcripts SET ${updateFields.join(', ')} WHERE video_id = ?`;
      
      db.run(updateQuery, updateValues, function(updateErr) {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ success: true, id: row.id, action: 'updated' });
      });
    } else {
      const insertQuery = `
        INSERT INTO youtube_transcripts (video_id, transcript_uri, transcript_text, summary_uri, summary_text)
        VALUES (?, ?, ?, ?, ?)
      `;
      db.run(insertQuery, [video_id, transcript_uri, transcript_text || null, summary_uri, summary_text || null], function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({ success: true, id: this.lastID, action: 'created' });
      });
    }
  });
});
};
