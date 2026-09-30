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

// ─────────────────────────────────────────────────────────────────────────────
// Supadata
// ─────────────────────────────────────────────────────────────────────────────

const SUPADATA_BASE = 'https://api.supadata.ai/v1';
const SUPADATA_POLL_INTERVAL_MS = 1000;
const SUPADATA_POLL_MAX_ATTEMPTS = 55;

async function supadataGet(path, apiKey) {
  const res = await fetch(`${SUPADATA_BASE}${path}`, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

/** Normaliza las tres formas que devuelve Supadata el texto. */
function extractCaptions(data) {
  if (typeof data.content === 'string') return data.content.trim();
  if (Array.isArray(data.content)) return data.content.map((c) => c.text || '').join(' ').trim();
  if (Array.isArray(data.transcript)) return data.transcript.map((c) => c.text || '').join(' ').trim();
  return '';
}

/**
 * Consulta un job asíncrono hasta que termine.
 *
 * Este flujo antes no existía. GET /youtube/transcript solo documentaba 200 y
 * 206, pero los videos de más de ~20 minutos se procesan fuera de banda y
 * contestan 202 con un jobId. Como el código solo miraba response.ok, el 202
 * contaba como éxito, se leía data.content (inexistente) y la respuesta era un
 * 404 "subtítulos vacíos" en lugar de una transcripción.
 */
async function pollTranscriptJob(jobId, apiKey) {
  for (let attempt = 1; attempt <= SUPADATA_POLL_MAX_ATTEMPTS; attempt += 1) {
    const { status, body } = await supadataGet(`/transcript/${encodeURIComponent(jobId)}`, apiKey);

    if (status === 404) {
      return { ok: false, reason: 'job_no_encontrado', retryable: false };
    }
    if (body.status === 'completed') {
      return { ok: true, data: body };
    }
    if (body.status === 'failed') {
      const { code, message } = readSupadataError(body);
      return {
        ok: false,
        reason: code || 'job_fallido',
        message: message || 'Supadata no pudo generar la transcripción.',
        // Reintentar con otro idioma crearia otro job, y cada uno se cobra.
        retryable: false,
      };
    }
    // queued / active: seguir esperando.
    await new Promise((r) => setTimeout(r, SUPADATA_POLL_INTERVAL_MS));
  }
  return {
    ok: false,
    reason: 'timeout',
    message: `Supadata no terminó en ${SUPADATA_POLL_MAX_ATTEMPTS}s.`,
    // El job sigue vivo del lado de Supadata: relanzar crearia otro.
    retryable: false,
  };
}

/**
 * Supadata usa dos formas distintas para el mismo concepto de error:
 * en una respuesta directa (4xx / 206) `error` es el código como string
 * ("transcript-unavailable"), y en el resultado de un job fallido `error` es el
 * objeto Error completo. Se normalizan aqui para no ramificar en cada sitio.
 */
function readSupadataError(body) {
  const raw = body?.error;
  if (typeof raw === 'string') {
    return { code: raw, message: body?.message || body?.details || null };
  }
  if (raw && typeof raw === 'object') {
    return { code: raw.error || 'error', message: raw.message || raw.details || body?.message || null };
  }
  return { code: null, message: body?.message || body?.details || null };
}

/**
 * Pide la transcripción y resuelve tanto la vía síncrona como la asíncrona.
 * `mode` native solo busca subtítulos existentes; auto (default) cae a
 * generación por IA cuando no los hay.
 */
async function requestSupadataTranscript(videoId, language, mode, apiKey) {
  const params = new URLSearchParams({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    text: 'true',
  });
  if (language) params.set('lang', language);
  if (mode) params.set('mode', mode);

  const { status, body } = await supadataGet(`/transcript?${params.toString()}`, apiKey);

  if (status === 202 && body.jobId) {
    return { ...(await pollTranscriptJob(body.jobId, apiKey)), async: true };
  }
  if (status === 206) {
    // 206 "transcript unavailable" pertenece al contrato del endpoint DEPRECADO
    // /youtube/transcript. En el endpoint actual /transcript la misma
    // situación llega como 404 con error:"transcript-unavailable", que cae en
    // la rama siguiente. Se conserva el 206 por si Supadata lo reutiliza: es
    // un 2xx, asi que response.ok no lo filtraria, y cobrar 1 credito
    // devolviendo un "exito" sin transcripcion seria el peor resultado posible.
    const { code, message } = readSupadataError(body);
    return { ok: false, reason: code || 'transcript_unavailable', message, retryable: true };
  }
  if (!status || status >= 400) {
    const { code, message } = readSupadataError(body);
    // 404 con transcript-unavailable sí reintenta: en mode=native puede haber
    // subtítulos en otro idioma. Un 400 (peticion invalida) o un 401/403 no:
    // reintentarlos solo gasta tiempo.
    const reintentable = !(status === 400 || status === 401 || status === 403);
    return { ok: false, reason: code || `http_${status}`, message, retryable: reintentable };
  }
  if (body.jobId) {
    return { ...(await pollTranscriptJob(body.jobId, apiKey)), async: true };
  }
  return { ok: true, data: body };
}

/**
 * Obtener subtítulos de un video de YouTube usando Supadata.ai
 */
/** Modos que acepta el endpoint /transcript. El valor por defecto de Supadata es 'auto'. */
const SUPADATA_MODES = new Set(['native', 'auto', 'generate']);

exports.getYoutubeCaptions = async (req, res) => {
  const { video_id, language = 'es', mode = 'auto' } = req.body;

  if (!video_id) {
    return res.status(400).json({ error: 'Falta video_id' });
  }

  // Se valida en vez de reenviar: un mode invalido seria un 400 de Supadata y
  // un error opaco para el usuario, cuando el problema es de nuestra entrada.
  if (!SUPADATA_MODES.has(mode)) {
    return res.status(400).json({
      error: `mode invalido: '${mode}'. Valores admitidos: ${[...SUPADATA_MODES].join(', ')}.`,
    });
  }

  const SUPADATA_KEY = secrets.SUPADATA_API_KEY;
  if (!SUPADATA_KEY) {
    return res.status(500).json({ error: 'SUPADATA_API_KEY no configurada en el servidor.' });
  }

  /**
   * Reintentos en orden de preferencia: idioma pedido, inglés, cualquier
   * idioma disponible. Sin lang Supadata devuelve el primer idioma que exista.
   *
   * SOLO con mode=native. Coste real por petición (pricing oficial de Supadata):
   *   native  -> 1 crédito, y otro idioma puede existir de verdad.
   *   auto    -> si no hay subtítulos, genera con IA: 2 créditos POR MINUTO de
   *              vídeo. Reintentar con otro idioma vuelve a generar y vuelve a
   *              facturar. Para un vídeo de 20 minutos, 3 intentos_AUTO
   *              costarian 120 créditos en vez de 40, y en auto Supadata ya
   *              devuelve el primer idioma disponible cuando el pedido no
   *              existe, asi que el reintento no aporta nada.
   */
  const attempts = mode === 'native'
    ? [language, 'en', null].filter((lang, i, arr) => lang === null || arr.indexOf(lang) === i)
    : [language];

  let lastReason = 'desconocido';
  let lastMessage = null;

  for (const lang of attempts) {
    const result = await requestSupadataTranscript(video_id, lang, mode, SUPADATA_KEY);
    if (!result.ok) {
      lastReason = result.reason;
      lastMessage = result.message || lastMessage;
      if (result.retryable === false) break;
      continue;
    }

    const captions = extractCaptions(result.data);
    if (captions.length < 10) {
      lastReason = 'vacio';
      continue;
    }

    return res.json({
      captions,
      language: result.data.lang || lang || 'auto',
      source: 'supadata',
      async: Boolean(result.async),
    });
  }

  return res.status(404).json({
    error: 'No se pudieron obtener los subtítulos de este video.',
    details: `Supadata: ${lastReason}${lastMessage ? ` - ${lastMessage}` : ''}`,
  });
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
