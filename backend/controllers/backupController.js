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
    if (!err && r) stats.photos.total = r.total;
    db.get(
      `SELECT COUNT(*) as backed FROM photos p
       JOIN subjects s ON p.subject_id = s.id
       WHERE s.user_id = ? AND p.is_backed_up = 1`,
      [userId], (err, r) => {
      if (!err && r) stats.photos.backed = r.backed;

      // ── Grabaciones de audio ──
      db.get('SELECT COUNT(*) as total FROM audio_recordings WHERE user_id = ?', [userId], (err, r) => {
        if (!err && r) stats.audio.total = r.total;
        db.get('SELECT COUNT(*) as backed FROM audio_recordings WHERE user_id = ? AND is_backed_up = 1', [userId], (err, r) => {
          if (!err && r) stats.audio.backed = r.backed;

          // ── Documentos escaneados ──
          db.get('SELECT COUNT(*) as total FROM scanned_documents WHERE user_id = ?', [userId], (err, r) => {
            if (!err && r) stats.docs.total = r.total;
            db.get('SELECT COUNT(*) as backed FROM scanned_documents WHERE user_id = ? AND is_backed_up = 1', [userId], (err, r) => {
              if (!err && r) stats.docs.backed = r.backed;

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
                     WHERE ar.user_id = ? AND at.is_backed_up = 1`,
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
     WHERE s.user_id = ? AND p.is_backed_up = 0`,
    [userId], (err, rows) => {
      if (!err && rows) result.photos = rows;

    db.all('SELECT id, local_uri, name FROM audio_recordings WHERE user_id = ? AND is_backed_up = 0', [userId], (err, rows) => {
      if (!err && rows) result.audio = rows;

      db.all('SELECT id, local_uri, name FROM scanned_documents WHERE user_id = ? AND is_backed_up = 0', [userId], (err, rows) => {
        if (!err && rows) result.docs = rows;

        db.all(
          `SELECT at.id, 'audio' as type, at.transcript_text as text, at.recording_id
           FROM audio_transcripts at
           JOIN audio_recordings ar ON ar.id = at.recording_id
           WHERE ar.user_id = ? AND at.is_backed_up = 0 AND at.transcript_text IS NOT NULL`,
          [userId], (err, rows) => {
            if (!err && rows) result.transcripts = [...result.transcripts, ...rows];

            db.all(
              `SELECT yt.id, 'youtube' as type, yt.transcript_text as text, yt.video_id
               FROM youtube_transcripts yt
               JOIN youtube_videos yv ON yv.id = yt.video_id
               WHERE yv.user_id = ? AND yt.is_backed_up = 0 AND yt.transcript_text IS NOT NULL`,
              [userId], (err, rows) => {
                if (!err && rows) result.transcripts = [...result.transcripts, ...rows];
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
 * Body: { type: 'photo'|'audio'|'document'|'transcript', id, cloud_url, transcript_type? }
 */
exports.markAsBackedUp = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autenticado.' });

  const { type, id, cloud_url, transcript_type } = req.body;
  if (!type || !id || !cloud_url) {
    return res.status(400).json({ error: 'Se requieren type, id y cloud_url.' });
  }

  const tableMap = {
    photo: 'photos',
    audio: 'audio_recordings',
    document: 'scanned_documents',
  };

  if (type === 'transcript') {
    const table = transcript_type === 'youtube' ? 'youtube_transcripts' : 'audio_transcripts';
    db.run(
      `UPDATE ${table} SET cloud_url = ?, is_backed_up = 1 WHERE id = ?`,
      [cloud_url, id],
      function (err) {
        if (err) return res.status(500).json({ error: 'Error al marcar transcripción.' });
        res.json({ ok: true });
      }
    );
    return;
  }

  const table = tableMap[type];
  if (!table) return res.status(400).json({ error: `Tipo desconocido: ${type}` });

  if (type === 'photo') {
    db.run(
      `UPDATE photos SET cloud_url = ?, is_backed_up = 1 
       WHERE id = ? AND subject_id IN (SELECT id FROM subjects WHERE user_id = ?)`,
      [cloud_url, id, userId],
      function (err) {
        if (err) return res.status(500).json({ error: 'Error al marcar foto.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Foto no encontrada o sin permiso.' });
        res.json({ ok: true });
      }
    );
    return;
  }

  // Verificar que el ítem pertenece al usuario antes de actualizar
  db.run(
    `UPDATE ${table} SET cloud_url = ?, is_backed_up = 1 WHERE id = ? AND user_id = ?`,
    [cloud_url, id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error al marcar ítem.' });
      if (this.changes === 0) return res.status(404).json({ error: 'Ítem no encontrado.' });
      res.json({ ok: true });
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
     WHERE s.user_id = ? AND p.is_backed_up = 1 AND p.cloud_url IS NOT NULL`,
    [userId],
    (err, rows) => {
      if (!err && rows) result.photos = rows;

      // Grabaciones de audio
      db.all(
        `SELECT id, local_uri, cloud_url, name, subject_id, duration, created_at
         FROM audio_recordings
         WHERE user_id = ? AND is_backed_up = 1 AND cloud_url IS NOT NULL`,
        [userId],
        (err, rows) => {
          if (!err && rows) result.audio = rows;

          // Documentos escaneados
          db.all(
            `SELECT id, local_uri, cloud_url, name, subject_id, created_at
             FROM scanned_documents
             WHERE user_id = ? AND is_backed_up = 1 AND cloud_url IS NOT NULL`,
            [userId],
            (err, rows) => {
              if (!err && rows) result.docs = rows;

              // Transcripciones de audio
              db.all(
                `SELECT at.id, at.cloud_url, at.transcript_text, at.recording_id,
                        'audio' as transcript_type, ar.name as recording_name
                 FROM audio_transcripts at
                 JOIN audio_recordings ar ON ar.id = at.recording_id
                 WHERE ar.user_id = ? AND at.is_backed_up = 1 AND at.cloud_url IS NOT NULL`,
                [userId],
                (err, rows) => {
                  if (!err && rows) result.transcripts = [...result.transcripts, ...rows];

                  // Transcripciones de YouTube
                  db.all(
                    `SELECT yt.id, yt.cloud_url, yt.transcript_text, yt.video_id,
                            'youtube' as transcript_type, yv.title as video_title
                     FROM youtube_transcripts yt
                     JOIN youtube_videos yv ON yv.id = yt.video_id
                     WHERE yv.user_id = ? AND yt.is_backed_up = 1 AND yt.cloud_url IS NOT NULL`,
                    [userId],
                    (err, rows) => {
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
