const { v4: uuidv4 } = require('uuid');
const secrets = require('../config/secrets');
const { db } = require('../db');
const { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, recordDeletions, updateWithVersionGuard, removeDeletion, respondStaleVersion } = require('../helpers/syncVersion');

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
  const { id: clientId, user_id, subject_id, youtube_url, video_id, title, thumbnail_url, duration, sync_version: incomingVersion, version_number } = req.body;
  
  if (!user_id || !youtube_url || !video_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos: user_id, youtube_url, video_id' });
  }

  const authenticatedUserId = req.user.id;
  if (String(user_id) !== String(authenticatedUserId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const ytVideoId = clientId || uuidv4();
  const hasVersion = incomingVersion !== undefined && incomingVersion !== null;
  
  const query = `
    INSERT INTO youtube_videos (id, user_id, subject_id, youtube_url, video_id, title, thumbnail_url, duration, version_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0))
    ON CONFLICT(id) DO UPDATE SET
      subject_id = excluded.subject_id,
      youtube_url = excluded.youtube_url,
      video_id = excluded.video_id,
      title = excluded.title,
      thumbnail_url = excluded.thumbnail_url,
      duration = excluded.duration,
      version_number = COALESCE(excluded.version_number, youtube_videos.version_number + 1),
      updated_at = datetime('now')
      ${hasVersion ? 'WHERE youtube_videos.sync_version IS NULL OR youtube_videos.sync_version <= ?' : ''}
  `;
  
  const params = [ytVideoId, user_id, subject_id || null, youtube_url, video_id, title || null, thumbnail_url || null, duration || null, version_number || 0];
  if (hasVersion) params.push(incomingVersion);

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    removeDeletion('youtube_videos', ytVideoId, user_id);
    incrementSyncVersion('youtube_videos', ytVideoId, () => {
      res.status(201).json({ success: true, id: ytVideoId });
    });
  });
};

/**
 * Actualizar un video de YouTube (ej: cambiar materia, título)
 */
exports.updateYoutubeVideo = (req, res) => {
  const { id } = req.params;
  const { sync_version: incomingVersion, version_number } = req.body;
  const fields = req.body;
  const userId = req.user.id;
  
  const allowedFields = ['subject_id', 'title', 'thumbnail_url', 'duration'];
  const fieldsToUpdate = {};
  
  for (const key of Object.keys(fields)) {
    if (allowedFields.includes(key)) {
      fieldsToUpdate[key] = fields[key];
    }
  }
  
  if (version_number !== undefined) {
    fieldsToUpdate['version_number'] = version_number;
  }
  fieldsToUpdate['updated_at'] = new Date().toISOString();

  if (Object.keys(fieldsToUpdate).length === 1 && fieldsToUpdate['updated_at']) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }
  
  const columns = Object.keys(fieldsToUpdate);
  const values = Object.values(fieldsToUpdate);

  updateWithVersionGuard('youtube_videos', id, columns, values, incomingVersion, (err, changes) => {
    if (err) return res.status(500).json({ error: err.message });
    if (changes === 0) {
      // Verificar si es un rechazo por version_guard o simplemente no existe
      return db.get('SELECT id, user_id FROM youtube_videos WHERE id = ?', [id], (checkErr, checkRow) => {
        if (checkErr || !checkRow || String(checkRow.user_id) !== String(userId)) {
          return res.status(404).json({ error: 'Video no encontrado o acceso denegado' });
        }
        return respondStaleVersion(res, 'youtube_videos', id);
      });
    }
    incrementSyncVersion('youtube_videos', id, () => {
      res.json({ success: true, changes });
    });
  });
};

/**
 * Eliminar un video de YouTube
 */
exports.deleteYoutubeVideo = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  db.get('SELECT id FROM youtube_videos WHERE id = ? AND user_id = ?', [id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Video no encontrado o acceso denegado' });

    recordDeletion('youtube_videos', id, userId, () => {
      incrementSyncCounterOnly(() => {
        db.run(`DELETE FROM youtube_videos WHERE id = ? AND user_id = ?`, [id, userId], function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ success: true, changes: this.changes });
        });
      });
    });
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
  const { id: clientId, video_id, transcript_uri, transcript_text, summary_uri, summary_text } = req.body;
  
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
      const transcriptId = clientId || uuidv4();
      const insertQuery = `
        INSERT INTO youtube_transcripts (id, video_id, transcript_uri, transcript_text, summary_uri, summary_text)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      db.run(insertQuery, [transcriptId, video_id, transcript_uri, transcript_text || null, summary_uri, summary_text || null], function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({ success: true, id: transcriptId, action: 'created' });
      });
    }
  });
});
};
