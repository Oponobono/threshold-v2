/**
 * Backup Controller
 * Expone endpoints para que el móvil pueda:
 * - Ver estadísticas de backup (cuántos ítems hay vs cuántos están respaldados)
 * - Obtener ítems pendientes de backup
 * - Marcar ítems como respaldados (guardando su cloud_url)
 */
const { db } = require('../db');

/**
 * GET /api/backup/stats
 * Devuelve cuántos ítems hay en total y cuántos están respaldados por tipo.
 */
exports.getBackupStats = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autenticado.' });

  const stats = {
    photos:      { total: 0, backed: 0 },
    audio:       { total: 0, backed: 0 },
    docs:        { total: 0, backed: 0 },
    transcripts: { total: 0, backed: 0 },
  };

  // ── Fotos: almacenadas en `photos` vinculadas via subjects.user_id ──
  db.get(
    `SELECT COUNT(*) as total FROM photos p
     JOIN subjects s ON p.subject_id = s.id
     WHERE s.user_id = ?`,
    [userId], (err, r) => {
      if (err) console.error(`[BackupStats] Error fotos total (User ${userId}):`, err);
      if (!err && r) stats.photos.total = Number(r.total);
      db.get(
        `SELECT COUNT(*) as backed FROM photos p
         JOIN subjects s ON p.subject_id = s.id
         WHERE s.user_id = ? AND COALESCE(p.is_backed_up, 0) = 1`,
        [userId], (err, r) => {
          if (err) console.error(`[BackupStats] Error fotos backed (User ${userId}):`, err);
          if (!err && r) stats.photos.backed = Number(r.backed);

      // ── Grabaciones de audio ──
      db.get('SELECT COUNT(*) as total FROM audio_recordings WHERE user_id = ?', [userId], (err, r) => {
        if (err) console.error(`[BackupStats] Error audio total (User ${userId}):`, err);
        if (!err && r) stats.audio.total = Number(r.total);
        db.get('SELECT COUNT(*) as backed FROM audio_recordings WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1', [userId], (err, r) => {
          if (err) console.error(`[BackupStats] Error audio backed (User ${userId}):`, err);
          if (!err && r) stats.audio.backed = Number(r.backed);

          // ── Documentos escaneados ──
          db.get('SELECT COUNT(*) as total FROM scanned_documents WHERE user_id = ?', [userId], (err, r) => {
            if (err) console.error(`[BackupStats] Error docs total (User ${userId}):`, err);
            if (!err && r) stats.docs.total = Number(r.total);
            db.get('SELECT COUNT(*) as backed FROM scanned_documents WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1', [userId], (err, r) => {
              if (err) console.error(`[BackupStats] Error docs backed (User ${userId}):`, err);
              if (!err && r) stats.docs.backed = Number(r.backed);

              // ── Transcripciones de audio ──
              db.get(
                `SELECT COUNT(*) as total FROM audio_transcripts at
                 JOIN audio_recordings ar ON ar.id = at.recording_id
                 WHERE ar.user_id = ? AND at.transcript_text IS NOT NULL`,
                [userId], (err, r) => {
                  if (!err && r) stats.transcripts.total += Number(r.total);
                  db.get(
                    `SELECT COUNT(*) as backed FROM audio_transcripts at
                     JOIN audio_recordings ar ON ar.id = at.recording_id
                     WHERE ar.user_id = ? AND COALESCE(at.is_backed_up, 0) = 1`,
                    [userId], (err, r) => {
                      if (!err && r) stats.transcripts.backed += Number(r.backed);

                      // ── Transcripciones de YouTube ──
                      // NOTA: youtube_transcripts puede no tener is_backed_up; usamos COALESCE para seguridad
                      db.get(
                        `SELECT COUNT(*) as total FROM youtube_transcripts yt
                         JOIN youtube_videos yv ON yv.id = yt.video_id
                         WHERE yv.user_id = ? AND yt.transcript_text IS NOT NULL`,
                        [userId], (err, r) => {
                          if (!err && r) stats.transcripts.total += Number(r.total);
                          db.get(
                            `SELECT COUNT(*) as backed FROM youtube_transcripts yt
                             JOIN youtube_videos yv ON yv.id = yt.video_id
                             WHERE yv.user_id = ? AND COALESCE(yt.is_backed_up, 0) = 1`,
                            [userId], (err, r) => {
                              if (!err && r) stats.transcripts.backed += Number(r.backed);
                              console.log(`[BackupStats] User ${userId}:`, JSON.stringify(stats));
                              res.json(stats);
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            });
          });
        });
      });
    });
  });
};

/**
 * GET /api/backup/pending
 * Devuelve todos los ítems no respaldados agrupados por tipo.
 */
exports.getPendingItems = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autenticado.' });

  const result = { photos: [], audio: [], docs: [], transcripts: [] };

  db.all(
    `SELECT p.id, p.local_uri as uri 
     FROM photos p 
     JOIN subjects s ON p.subject_id = s.id 
     WHERE s.user_id = ? AND COALESCE(p.is_backed_up, 0) = 0`,
    [userId], (err, rows) => {
      if (err) console.error(`[PendingItems] Error fotos (User ${userId}):`, err);
      if (!err && rows) result.photos = rows;

    db.all('SELECT id, local_uri, name FROM audio_recordings WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 0', [userId], (err, rows) => {
      if (err) console.error(`[PendingItems] Error audio (User ${userId}):`, err);
      if (!err && rows) result.audio = rows;

      db.all('SELECT id, local_uri, name FROM scanned_documents WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 0', [userId], (err, rows) => {
        if (err) console.error(`[PendingItems] Error docs (User ${userId}):`, err);
        if (!err && rows) result.docs = rows;

        db.all(
          `SELECT at.id, 'audio' as type, at.transcript_text as text, at.recording_id
           FROM audio_transcripts at
           JOIN audio_recordings ar ON ar.id = at.recording_id
           WHERE ar.user_id = ? AND COALESCE(at.is_backed_up, 0) = 0 AND at.transcript_text IS NOT NULL`,
          [userId], (err, rows) => {
            if (!err && rows) result.transcripts = [...result.transcripts, ...rows];

            db.all(
              `SELECT yt.id, 'youtube' as type, yt.transcript_text as text, yt.video_id
               FROM youtube_transcripts yt
               JOIN youtube_videos yv ON yv.id = yt.video_id
               WHERE yv.user_id = ? AND COALESCE(yt.is_backed_up, 0) = 0 AND yt.transcript_text IS NOT NULL`,
              [userId], (err, rows) => {
                if (!err && rows) result.transcripts = [...result.transcripts, ...rows];
                console.log(`[PendingItems] User ${userId}:`, {
                  photos: result.photos.length,
                  audio: result.audio.length,
                  docs: result.docs.length,
                  transcripts: result.transcripts.length
                });
                res.json(result);
              }
            );
          }
        );
      });
    });
  });
};

/**
 * POST /api/backup/mark
 * Marca un ítem como respaldado y guarda su cloud_url.
 * Si el ítem no existe en el backend (fue creado offline), lo inserta automáticamente.
 * Body: { type: 'photo'|'audio'|'document'|'transcript', id, cloud_url, transcript_type?,
 *         subject_id?, user_id? (para inserción de items offline) }
 */
exports.markAsBackedUp = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autenticado.' });

  const { type, id, cloud_url, transcript_type, subject_id, user_id: bodyUserId } = req.body;
  if (!type || !id || !cloud_url) {
    return res.status(400).json({ error: 'Se requieren type, id y cloud_url.' });
  }

  if (type === 'transcript') {
    const table = transcript_type === 'youtube' ? 'youtube_transcripts' : 'audio_transcripts';
    db.run(
      `UPDATE ${table} SET cloud_url = ?, is_backed_up = 1 WHERE id = ?`,
      [cloud_url, id],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar transcripción:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar transcripción.' }); }
        // Para transcripciones, 0 changes no es error crítico — se ignora
        res.json({ ok: true });
      }
    );
    return;
  }

  if (type === 'photo') {
    // Primero intentar UPDATE normal (item ya existe en backend)
    db.run(
      `UPDATE photos SET cloud_url = ?, is_backed_up = 1
       WHERE id = ? AND subject_id IN (SELECT id FROM subjects WHERE user_id = ?)`,
      [cloud_url, id, userId],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar foto:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar foto.' }); }
        if (this.changes > 0) return res.json({ ok: true });

        // 0 changes → foto no existe en backend (fue creada offline).
        // Insertar con los datos mínimos disponibles.
        const resolvedSubjectId = subject_id || null;
        db.run(
          `INSERT INTO photos (id, subject_id, local_uri, cloud_url, is_backed_up)
           VALUES (?, ?, '', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, resolvedSubjectId, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar foto offline:', insertErr.message);
              return res.status(500).json({ error: 'Error al registrar foto offline.' });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      }
    );
    return;
  }

  const tableMap = {
    audio: 'audio_recordings',
    document: 'scanned_documents',
  };
  const table = tableMap[type];
  if (!table) return res.status(400).json({ error: `Tipo desconocido: ${type}` });

  // Primero intentar UPDATE normal
  db.run(
    `UPDATE ${table} SET cloud_url = ?, is_backed_up = 1 WHERE id = ? AND user_id = ?`,
    [cloud_url, id, userId],
    function (err) {
      if (err) { console.error('[Backup] Error al marcar ítem:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar ítem.' }); }
      if (this.changes > 0) return res.json({ ok: true });

      // 0 changes → ítem no existe en backend (fue creado offline).
      // Insertar con datos mínimos.
      const insertQuery = table === 'audio_recordings'
        ? `INSERT INTO audio_recordings (id, user_id, local_uri, cloud_url, is_backed_up)
           VALUES (?, ?, '', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`
        : `INSERT INTO scanned_documents (id, user_id, local_uri, cloud_url, is_backed_up)
           VALUES (?, ?, '', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`;

      db.run(insertQuery, [id, userId, cloud_url], function (insertErr) {
        if (insertErr) {
          console.error('[Backup] Error al insertar ítem offline:', insertErr.message);
          return res.status(500).json({ error: 'Error al registrar ítem offline.' });
        }
        res.json({ ok: true, inserted: true });
      });
    }
  );
};


/**
 * POST /api/backup/restore-local-uri
 * Actualiza la local_uri de un ítem tras descargarlo en un nuevo dispositivo.
 * Body: { type: 'photo'|'audio'|'document', id, local_uri }
 */
exports.restoreLocalUri = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autenticado.' });

  const { type, id, local_uri } = req.body;
  if (!type || !id || !local_uri) {
    return res.status(400).json({ error: 'Se requieren type, id y local_uri.' });
  }

  if (type === 'photo') {
    db.run(
      `UPDATE photos SET local_uri = ? WHERE id = ? AND subject_id IN (SELECT id FROM subjects WHERE user_id = ?)`,
      [local_uri, id, userId],
      function (err) {
        if (err) return res.status(500).json({ error: 'Error al restaurar URI de foto.' });
        res.json({ ok: true, changes: this.changes });
      }
    );
    return;
  }

  const tableMap = { audio: 'audio_recordings', document: 'scanned_documents' };
  const table = tableMap[type];
  if (!table) return res.status(400).json({ error: `Tipo desconocido: ${type}` });

  db.run(
    `UPDATE ${table} SET local_uri = ? WHERE id = ? AND user_id = ?`,
    [local_uri, id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error al restaurar URI.' });
      res.json({ ok: true, changes: this.changes });
    }
  );
};

/**
 * GET /api/backup/cloud-items
 * Devuelve todos los ítems que tienen una copia en la nube (cloud_url definida).
 * Usado por el móvil para descargar archivos en un dispositivo nuevo.
 */
exports.getCloudItems = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autenticado.' });

  const result = { photos: [], audio: [], docs: [], transcripts: [] };

  // Fotos (vinculadas a materias via subjects.user_id)
  db.all(
    `SELECT p.id, p.local_uri, p.cloud_url, p.subject_id, p.created_at,
            s.name as subject_name
     FROM photos p
     JOIN subjects s ON p.subject_id = s.id
     WHERE s.user_id = ? AND COALESCE(p.is_backed_up, 0) = 1 AND p.cloud_url IS NOT NULL`,
    [userId],
    (err, rows) => {
      if (err) console.error(`[CloudItems] Error fotos (User ${userId}):`, err.message);
      if (!err && rows) result.photos = rows;

      // Grabaciones de audio
      db.all(
        `SELECT id, local_uri, cloud_url, name, subject_id, duration, created_at
         FROM audio_recordings
         WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1 AND cloud_url IS NOT NULL`,
        [userId],
        (err, rows) => {
          if (err) console.error(`[CloudItems] Error audio (User ${userId}):`, err.message);
          if (!err && rows) result.audio = rows;

          // Documentos escaneados
          db.all(
            `SELECT id, local_uri, cloud_url, name, subject_id, created_at
             FROM scanned_documents
             WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1 AND cloud_url IS NOT NULL`,
            [userId],
            (err, rows) => {
              if (err) console.error(`[CloudItems] Error docs (User ${userId}):`, err.message);
              if (!err && rows) result.docs = rows;

              // Transcripciones de audio
              db.all(
                `SELECT at.id, at.cloud_url, at.transcript_text, at.summary_text, at.recording_id,
                        'audio' as transcript_type, ar.name as recording_name
                 FROM audio_transcripts at
                 JOIN audio_recordings ar ON ar.id = at.recording_id
                 WHERE ar.user_id = ? AND COALESCE(at.is_backed_up, 0) = 1 AND at.cloud_url IS NOT NULL`,
                [userId],
                (err, rows) => {
                  if (err) console.error(`[CloudItems] Error transcripts audio (User ${userId}):`, err.message);
                  if (!err && rows) result.transcripts = [...result.transcripts, ...rows];

                  // Transcripciones de YouTube
                  db.all(
                    `SELECT yt.id, yt.cloud_url, yt.transcript_text, yt.summary_text, yt.video_id,
                            'youtube' as transcript_type, yv.title as video_title
                     FROM youtube_transcripts yt
                     JOIN youtube_videos yv ON yv.id = yt.video_id
                     WHERE yv.user_id = ? AND COALESCE(yt.is_backed_up, 0) = 1 AND yt.cloud_url IS NOT NULL`,
                    [userId],
                    (err, rows) => {
                      if (err) console.error(`[CloudItems] Error transcripts youtube (User ${userId}):`, err.message);
                      if (!err && rows) result.transcripts = [...result.transcripts, ...rows];
                      res.json(result);
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};
