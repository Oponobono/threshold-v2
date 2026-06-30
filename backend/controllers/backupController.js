/**
 * Backup Controller
 * Expone endpoints para que el móvil pueda:
 * - Ver estadísticas de backup (cuántos ítems hay vs cuántos están respaldados)
 * - Obtener ítems pendientes de backup
 * - Marcar ítems como respaldados (guardando su cloud_url)
 */
const { db } = require('../db');
const { incrementSyncVersion, incrementSyncCounterOnly } = require('../helpers/syncVersion');

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
    assessmentFiles: { total: 0, backed: 0 },
    flashcardDecks: { total: 0, backed: 0 },
    aiChats: { total: 0, backed: 0 },
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
                              db.get(
                                `SELECT COUNT(*) as total FROM assessment_files af
                                 JOIN assessments a ON a.id = af.assessment_id
                                 JOIN subjects s ON s.id = a.subject_id
                                 WHERE s.user_id = ? AND af.local_uri IS NOT NULL`,
                                [userId], (err, r) => {
                                  if (!err && r) stats.assessmentFiles.total = Number(r.total);
                                  db.get(
                                    `SELECT COUNT(*) as backed FROM assessment_files af
                                     JOIN assessments a ON a.id = af.assessment_id
                                     JOIN subjects s ON s.id = a.subject_id
                                     WHERE s.user_id = ? AND COALESCE(af.is_backed_up, 0) = 1`,
                                    [userId], (err, r) => {
                                      if (!err && r) stats.assessmentFiles.backed = Number(r.backed);

                                      // ── Mazos de flashcards ──
                                      db.get('SELECT COUNT(*) as total FROM flashcard_decks WHERE user_id = ?', [userId], (err, r) => {
                                        if (err) console.error(`[BackupStats] Error decks total (User ${userId}):`, err);
                                        if (!err && r) stats.flashcardDecks.total = Number(r.total);
                                        db.get('SELECT COUNT(*) as backed FROM flashcard_decks WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1', [userId], (err, r) => {
                                          if (err) console.error(`[BackupStats] Error decks backed (User ${userId}):`, err);
                                          if (!err && r) stats.flashcardDecks.backed = Number(r.backed);

                                          // ── Chats de IA ──
                                          db.get('SELECT COUNT(*) as total FROM ai_chats WHERE user_id = ?', [userId], (err, r) => {
                                            if (err) console.error(`[BackupStats] Error aiChats total (User ${userId}):`, err);
                                            if (!err && r) stats.aiChats.total = Number(r.total);
                                            db.get('SELECT COUNT(*) as backed FROM ai_chats WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1', [userId], (err, r) => {
                                              if (err) console.error(`[BackupStats] Error aiChats backed (User ${userId}):`, err);
                                              if (!err && r) stats.aiChats.backed = Number(r.backed);

                                              console.log(`[BackupStats] User ${userId}:`, JSON.stringify(stats));
                                              res.json(stats);
                                            });
                                          });
                                        });
                                      });
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

  const result = { photos: [], audio: [], docs: [], transcripts: [], assessmentFiles: [], flashcardDecks: [], aiChats: [] };

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
                db.all(
                  `SELECT af.id, af.local_uri as uri, af.file_name as name, af.assessment_id
                   FROM assessment_files af
                   JOIN assessments a ON a.id = af.assessment_id
                   JOIN subjects s ON s.id = a.subject_id
                   WHERE s.user_id = ? AND COALESCE(af.is_backed_up, 0) = 0`,
                  [userId], (err, rows) => {
                    if (!err && rows) result.assessmentFiles = rows;

                  db.all('SELECT id, title, card_count FROM flashcard_decks WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 0', [userId], (err, rows) => {
                    if (!err && rows) result.flashcardDecks = rows;

                    db.all('SELECT id, role, content, subject_id FROM ai_chats WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 0 AND content IS NOT NULL ORDER BY created_at DESC', [userId], (err, rows) => {
                      if (!err && rows) result.aiChats = rows;

                      console.log(`[PendingItems] User ${userId}:`, {
                        photos: result.photos.length,
                        audio: result.audio.length,
                        docs: result.docs.length,
                        transcripts: result.transcripts.length,
                        assessmentFiles: result.assessmentFiles.length,
                        flashcardDecks: result.flashcardDecks.length,
                        aiChats: result.aiChats.length,
                      });
                      res.json(result);
                    });
                  });
                  }
                );
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
 * Body: { type: 'photo'|'audio'|'document'|'transcript'|'ai_chat'|'user_preference'|'flashcard_deck'|'flashcard',
 *         id, cloud_url, transcript_type?, subject_id?, user_id?, key? }
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
    const idColumn = transcript_type === 'youtube' ? 'video_id' : 'recording_id';
    db.run(
      `UPDATE ${table} SET cloud_url = ?, is_backed_up = 1 WHERE ${idColumn} = ?`,
      [cloud_url, id],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar transcripción:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar transcripción.' }); }
        if (this.changes > 0) return res.json({ ok: true });

        // 0 changes → insert fallback para transcripciones creadas offline
        db.run(
          `INSERT INTO ${table} (${idColumn}, cloud_url, is_backed_up) VALUES (?, ?, 1)
           ON CONFLICT(${idColumn}) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar transcripción offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar transcripción offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
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
              console.error('[Backup] Error al insertar foto offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar foto offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      }
    );
    return;
  }

  if (type === 'ai_chat') {
    const resolvedSubjectId = req.body.subject_id || null;
    db.run(
      `UPDATE ai_chats SET cloud_url = ?, is_backed_up = 1 WHERE id = ? AND user_id = ?`,
      [cloud_url, id, userId],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar chat IA:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar chat IA.' }); }
        if (this.changes > 0) return res.json({ ok: true });

        db.run(
          `INSERT INTO ai_chats (id, user_id, subject_id, role, content, cloud_url, is_backed_up)
           VALUES (?, ?, ?, 'user', 'Respaldo offline', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, userId, resolvedSubjectId, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar chat IA offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar chat IA offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      }
    );
    return;
  }

  if (type === 'user_preference') {
    const key = req.body.key || id;
    db.run(
      `UPDATE user_preferences SET cloud_url = ?, is_backed_up = 1, updated_at = datetime('now') WHERE key = ?`,
      [cloud_url, key],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar preferencia:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar preferencia.' }); }
        if (this.changes > 0) return res.json({ ok: true });

        db.run(
          `INSERT INTO user_preferences (key, value, cloud_url, is_backed_up)
           VALUES (?, 'Respaldo offline', ?, 1)
           ON CONFLICT(key) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [key, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar preferencia offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar preferencia offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      }
    );
    return;
  }

  if (type === 'flashcard_deck') {
    const { title: deckTitle = 'Mazo Offline', subject_id: deckSubjectId = null, linked_event_id = null } = req.body;
    db.run(
      `UPDATE flashcard_decks SET cloud_url = ?, is_backed_up = 1 WHERE id = ? AND user_id = ?`,
      [cloud_url, id, userId],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar mazo:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar mazo.' }); }
        if (this.changes > 0) {
          return incrementSyncVersion('flashcard_decks', id, (err) => {
            if (err) return res.status(500).json({ error: 'Error al actualizar sync_version.' });
            res.json({ ok: true });
          });
        }
        // 0 changes: mazo no existe en el backend (creado offline o antes del sync).
        // UPSERT para que cloud-items pueda devolvérselo al dispositivo 2.
        db.run(
          `INSERT INTO flashcard_decks (id, user_id, subject_id, title, linked_event_id, cloud_url, is_backed_up)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, userId, deckSubjectId, deckTitle, linked_event_id, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar mazo offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar mazo offline.', details: insertErr.message });
            }
            return incrementSyncVersion('flashcard_decks', id, (err) => {
              if (err) return res.status(500).json({ error: 'Error al actualizar sync_version.' });
              res.json({ ok: true, inserted: true });
            });
          }
        );
      }
    );
    return;
  }

  if (type === 'flashcard') {
    db.run(
      `UPDATE flashcards SET cloud_url = ?, is_backed_up = 1 WHERE id = ? AND deck_id IN (SELECT id FROM flashcard_decks WHERE user_id = ?)`,
      [cloud_url, id, userId],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar tarjeta:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar tarjeta.' }); }
        if (this.changes > 0) {
          return incrementSyncVersion('flashcards', id, (err) => {
            if (err) return res.status(500).json({ error: 'Error al actualizar sync_version.' });
            res.json({ ok: true });
          });
        }
        return incrementSyncVersion('flashcards', id, (err) => {
          if (err) return res.status(500).json({ error: 'Error al actualizar sync_version.' });
          res.json({ ok: true, warning: 'Tarjeta no encontrada en backend.' });
        });
      }
    );
    return;
  }

  const tableMap = {
    audio: 'audio_recordings',
    document: 'scanned_documents',
    assessment_file: 'assessment_files',
  };
  const table = tableMap[type];
  if (!table) return res.status(400).json({ error: `Tipo desconocido: ${type}` });

  if (table === 'assessment_files') {
    db.run(
      `UPDATE ${table} SET cloud_url = ?, is_backed_up = 1 WHERE id = ? AND assessment_id IN (SELECT a.id FROM assessments a JOIN subjects s ON s.id = a.subject_id WHERE s.user_id = ?)`,
      [cloud_url, id, userId],
      function (err) {
        if (err) { console.error('[Backup] Error al marcar ítem:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar ítem.' }); }
        if (this.changes > 0) return res.json({ ok: true });
        
        const resolvedAssessmentId = req.body.assessment_id || null;
        const resolvedFileName = req.body.file_name || 'Respaldo Offline';
        const resolvedFileType = req.body.file_type || 'application/octet-stream';
        db.run(
          `INSERT INTO assessment_files (id, assessment_id, file_name, file_type, local_uri, cloud_url, is_backed_up)
           VALUES (?, ?, ?, ?, '', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, resolvedAssessmentId, resolvedFileName, resolvedFileType, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar soporte de evaluación offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar soporte offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      }
    );
    return;
  }

  // Primero intentar UPDATE normal
  db.run(
    `UPDATE ${table} SET cloud_url = ?, is_backed_up = 1 WHERE id = ? AND user_id = ?`,
    [cloud_url, id, userId],
    function (err) {
      if (err) { console.error('[Backup] Error al marcar ítem:', err.message, err.code, err.stack); return res.status(500).json({ error: 'Error al marcar ítem.' }); }
      if (this.changes > 0) return res.json({ ok: true });

      // 0 changes → ítem no existe en backend (fue creado offline).
      // Insertar con datos mínimos.
      const resolvedSubjectId = req.body.subject_id || null;
      const resolvedName = req.body.name || 'Respaldo Offline';

      if (table === 'audio_recordings') {
        db.run(
          `INSERT INTO audio_recordings (id, user_id, subject_id, name, local_uri, cloud_url, is_backed_up)
           VALUES (?, ?, ?, ?, '', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, userId, resolvedSubjectId, resolvedName, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar audio offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar audio offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      } else if (table === 'assessment_files') {
        const resolvedAssessmentId = req.body.assessment_id || null;
        const resolvedFileName = req.body.file_name || 'Respaldo Offline';
        const resolvedFileType = req.body.file_type || 'application/octet-stream';
        db.run(
          `INSERT INTO assessment_files (id, assessment_id, file_name, file_type, local_uri, cloud_url, is_backed_up)
           VALUES (?, ?, ?, ?, '', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, resolvedAssessmentId, resolvedFileName, resolvedFileType, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar soporte de evaluación offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar soporte offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      } else {
        db.run(
          `INSERT INTO scanned_documents (id, user_id, subject_id, name, local_uri, cloud_url, is_backed_up)
           VALUES (?, ?, ?, ?, '', ?, 1)
           ON CONFLICT(id) DO UPDATE SET cloud_url = excluded.cloud_url, is_backed_up = 1`,
          [id, userId, resolvedSubjectId, resolvedName, cloud_url],
          function (insertErr) {
            if (insertErr) {
              console.error('[Backup] Error al insertar documento offline:', insertErr.message, insertErr.code, insertErr.stack);
              return res.status(500).json({ error: 'Error al registrar documento offline.', details: insertErr.message });
            }
            res.json({ ok: true, inserted: true });
          }
        );
      }
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

  const tableMap = { audio: 'audio_recordings', document: 'scanned_documents', assessment_file: 'assessment_files' };
  const table = tableMap[type];
  if (!table) return res.status(400).json({ error: `Tipo desconocido: ${type}` });

  if (table === 'assessment_files') {
    db.run(
      `UPDATE assessment_files SET local_uri = ? WHERE id = ? AND assessment_id IN (SELECT a.id FROM assessments a JOIN subjects s ON s.id = a.subject_id WHERE s.user_id = ?)`,
      [local_uri, id, userId],
      function (err) {
        if (err) return res.status(500).json({ error: 'Error al restaurar URI de soporte.' });
        res.json({ ok: true, changes: this.changes });
      }
    );
    return;
  }

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

  const result = { photos: [], audio: [], docs: [], transcripts: [], assessmentFiles: [], flashcardDecks: [], aiChats: [] };

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
                      db.all(
                        `SELECT af.id, af.cloud_url, af.file_name as name, af.assessment_id, af.created_at
                         FROM assessment_files af
                         JOIN assessments a ON a.id = af.assessment_id
                         JOIN subjects s ON s.id = a.subject_id
                         WHERE s.user_id = ? AND COALESCE(af.is_backed_up, 0) = 1 AND af.cloud_url IS NOT NULL`,
                        [userId],
                        (err, rows) => {
                          if (err) console.error(`[CloudItems] Error assessment files (User ${userId}):`, err.message);
                          if (!err && rows) result.assessmentFiles = rows;
                          db.all(
                            `SELECT id, cloud_url, title, subject_id, linked_event_id
                             FROM flashcard_decks
                             WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1 AND cloud_url IS NOT NULL`,
                            [userId],
                            (err, rows) => {
                              if (err) console.error(`[CloudItems] Error flashcard decks (User ${userId}):`, err.message);
                              if (!err && rows) result.flashcardDecks = rows;
                              db.all(
                                `SELECT id, cloud_url, role, content, subject_id, created_at
                                 FROM ai_chats
                                 WHERE user_id = ? AND COALESCE(is_backed_up, 0) = 1 AND cloud_url IS NOT NULL`,
                                [userId],
                                (err, rows) => {
                                  if (err) console.error(`[CloudItems] Error ai_chats (User ${userId}):`, err.message);
                                  if (!err && rows) result.aiChats = rows;
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
            }
          );
        }
      );
    }
  );
};
