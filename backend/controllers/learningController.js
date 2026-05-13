const { db } = require('../db');

/**
 * Obtener sesiones de estudio de un usuario
 */
exports.getStudySessions = (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT * FROM study_sessions WHERE user_id = ? ORDER BY start_timestamp DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

/**
 * Guardar una nueva sesión de estudio
 */
exports.createStudySession = (req, res) => {
  const { user_id, subject_id, session_type, config_value, duration_seconds, performance_rating } = req.body;
  
  if (!user_id || !session_type || duration_seconds === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos para la sesión de estudio.' });
  }

  const query = `
    INSERT INTO study_sessions (user_id, subject_id, session_type, config_value, duration_seconds, performance_rating)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [user_id, subject_id || null, session_type, config_value || null, duration_seconds, performance_rating || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Sesión de estudio guardada.' });
  });
};

/**
 * Obtener logs de tarjetas de un usuario (analytics)
 */
exports.getCardLogs = (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT * FROM card_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

const cardResultProcessor = require('../utils/cardResultProcessor');

exports.createCardLog = async (req, res) => {
  try {
    const { card_id, user_id, subject_id, result, response_time_ms, question_word_count } = req.body;
    
    if (!card_id || !user_id) {
      return res.status(400).json({ error: 'Faltan campos requeridos (card_id, user_id).' });
    }

    // Obtener tarjeta actual de la BD
    const currentCard = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM flashcards WHERE id = ?`, [card_id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!currentCard) {
      return res.status(404).json({ error: 'Tarjeta no encontrada' });
    }

    // MAGIC: Procesar resultado con learning engineering
    const isCorrect = result === 'correct' || result === true;
    const processingResult = await cardResultProcessor.processCardResult({
      cardId: card_id,
      userId: user_id,
      subjectId: subject_id || currentCard.deck_id, // Usamos deck_id como fallback temporal si subject_id no viene
      isCorrect,
      responseTimeMs: response_time_ms || 0,
      questionWordCount: question_word_count || currentCard.word_count || 20,
      currentCard,
    });

    // Guardar cambios en BD
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE flashcards SET 
         sm2_ease_factor = ?, sm2_interval = ?, sm2_repetitions = ?,
         next_review_date = ?
         WHERE id = ?`,
        [
          processingResult.cardUpdate.sm2_ease_factor,
          processingResult.cardUpdate.sm2_interval,
          processingResult.cardUpdate.sm2_repetitions,
          processingResult.cardUpdate.next_review_date,
          card_id,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Insertar log detallado
    const logId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO card_logs 
         (card_id, user_id, result, response_time_ms, 
          difficulty_deduced, normalized_time_ms, text_length_words)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          processingResult.logEntry.card_id,
          processingResult.logEntry.user_id,
          processingResult.logEntry.result,
          processingResult.logEntry.response_time_ms,
          processingResult.logEntry.difficulty_deduced,
          processingResult.logEntry.normalized_time_ms,
          processingResult.logEntry.text_length_words,
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    // Actualizar analíticas agregadas (nota: esto requiere que updateAnalyticsAfterResult use db correctamente con promises o callbacks)
    try {
      await cardResultProcessor.updateAnalyticsAfterResult(
        db,
        user_id,
        subject_id || currentCard.deck_id,
        card_id
      );
    } catch (analyticsError) {
      console.error('[learningController] Error updating analytics:', analyticsError);
      // No fallamos la request si la analítica falla
    }

    // Retornar respuesta completa
    res.status(201).json({
      success: true,
      logId: logId,
      message: 'Log de tarjeta guardado y procesado.',
      feedback: processingResult.feedback,
      microInteraction: processingResult.microInteraction,
      metrics: processingResult.metrics,
      analytics: {
        masteryPercentage: processingResult.metrics.quality,
      },
    });

  } catch (error) {
    console.error('[learningController.createCardLog] Error:', error);
    res.status(500).json({ error: 'Failed to process card result' });
  }
};

/**
 * Obtener los grupos de un usuario
 */
exports.getGroups = (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT * FROM group_memberships WHERE user_id = ? ORDER BY joined_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

/**
 * Unirse a un grupo mediante PIN
 */
exports.joinGroup = (req, res) => {
  const { user_id, group_pin_id } = req.body;
  
  if (!user_id || !group_pin_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  db.get(`SELECT id, username, name FROM users WHERE share_pin = ?`, [group_pin_id], (err, targetUser) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!targetUser) return res.status(404).json({ error: 'PIN de grupo no encontrado. Verifica e inténtalo de nuevo.' });
    if (targetUser.id === user_id) return res.status(400).json({ error: 'No puedes unirte a tu propia cuenta.' });

    db.get(`SELECT id FROM group_memberships WHERE user_id = ? AND group_pin_id = ?`, [user_id, group_pin_id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (row) return res.status(400).json({ error: 'Ya eres miembro de este grupo.' });

      const query = `
        INSERT INTO group_memberships (user_id, group_pin_id, role)
        VALUES (?, ?, 'member')
      `;

      db.run(query, [user_id, group_pin_id], function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({ id: this.lastID, message: `Te has unido exitosamente al grupo de ${targetUser.name || targetUser.username}.` });
      });
    });
  });
};

/**
 * Salir de un grupo
 */
exports.leaveGroup = (req, res) => {
  const { user_id, group_pin_id } = req.body;
  
  if (!user_id || !group_pin_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, group_pin_id).' });
  }

  const query = `DELETE FROM group_memberships WHERE user_id = ? AND group_pin_id = ?`;

  db.run(query, [user_id, group_pin_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'No se encontró la membresía del grupo.' });
    res.json({ message: 'Has salido del grupo exitosamente.' });
  });
};
