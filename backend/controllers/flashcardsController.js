const secrets = require('../config/secrets');
const { db } = require('../db');
const { analyzeCardDensity, fragmentCard } = require('../utils/atomicCardGenerator');
const { calculateSM2, calculateFSRS } = require('../utils/sm2Algorithm');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normaliza una fila de la BD al formato EvaluationItem que espera el frontend.
 * Para items legacy (flashcard con front/back), construye el content_json en memoria.
 */
function normalizeCard(row) {
  const itemType = row.item_type || 'flashcard';
  let content = null;

  if (row.content_json) {
    try { content = JSON.parse(row.content_json); } catch (_) {}
  }

  // Fallback para tarjetas antiguas sin content_json
  if (!content && itemType === 'flashcard') {
    content = { front: row.front || '', back: row.back || '' };
  }

  return {
    id: row.id,
    deck_id: row.deck_id,
    item_type: itemType,
    content,
    hint: row.hint || null,
    explanation: row.explanation || null,
    status: row.status || 'new',
    created_at: row.created_at,
    // SM-2 Spaced Repetition fields
    next_review_date: row.next_review_date || null,
    sm2_ease_factor: row.sm2_ease_factor || 2.5,
    sm2_interval: row.sm2_interval || 1,
    sm2_repetitions: row.sm2_repetitions || 0,
    // FSRS (Free Spaced Repetition Scheduler) fields
    fsrs_stability: row.fsrs_stability || 1,
    fsrs_difficulty: row.fsrs_difficulty || 0.5,
    fsrs_repetitions: row.fsrs_repetitions || 0,
    last_review_timestamp: row.last_review_timestamp || null,
    // Legacy fields kept for backward compat
    front: row.front,
    back: row.back,
  };
}

// ─── Deck CRUD ────────────────────────────────────────────────────────────────

/**
 * Obtener todos los mazos de flashcards del usuario (propios y compartidos)
 */
exports.getFlashcardDecks = (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Se requiere user_id' });
  const query = `
    SELECT fd.*, s.name as subject_name, s.color as subject_color, s.icon as subject_icon,
    u.username as owner_username, u.name as owner_name, fd.user_id as user_id,
    CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id) AS INTEGER) as card_count,
    CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.status = 'review') AS INTEGER) as review_count,
    CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.status = 'learning') AS INTEGER) as learning_count,
    CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.status = 'new') AS INTEGER) as new_count,
    CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND (fc.item_type = 'multiple_choice' OR fc.item_type IS NULL AND 0=1)) AS INTEGER) as mc_count,
    CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.item_type = 'boolean') AS INTEGER) as boolean_count
    FROM flashcard_decks fd
    JOIN users u ON fd.user_id = u.id
    LEFT JOIN subjects s ON fd.subject_id = s.id
    WHERE fd.user_id = ? 
       OR fd.id IN (
         SELECT sd.deck_id FROM shared_decks sd
         WHERE sd.shared_to_user_id = ?
       )
       OR fd.id IN (
         SELECT fd2.id FROM flashcard_decks fd2
         JOIN subjects s2 ON fd2.subject_id = s2.id
         WHERE s2.user_id IN (
           SELECT u2.id FROM users u2
           JOIN group_memberships gm ON gm.group_pin_id = u2.share_pin
           WHERE gm.user_id = ?
         )
       )
    ORDER BY fd.created_at DESC
  `;
  db.all(query, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Obtiene mazos con métricas de prioridad (tarjetas vencidas, promedio dominio)
 * Retorna mazos ordenados por urgencia
 */
exports.getFlashcardDecksWithMetrics = (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'Se requiere user_id' });
  
  const query = `
    SELECT 
      fd.*,
      s.name as subject_name,
      s.color as subject_color,
      s.icon as subject_icon,
      u.username as owner_username,
      u.name as owner_name,
      fd.user_id as user_id,
      CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id) AS INTEGER) as card_count,
      CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.status = 'review') AS INTEGER) as review_count,
      CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.status = 'learning') AS INTEGER) as learning_count,
      CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.status = 'new') AS INTEGER) as new_count,
      CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND (fc.item_type = 'multiple_choice' OR fc.item_type IS NULL AND 0=1)) AS INTEGER) as mc_count,
      CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.item_type = 'boolean') AS INTEGER) as boolean_count,
      COALESCE((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.next_review_date <= CURRENT_TIMESTAMP), 0) as due_count,
      COALESCE(la.mastery_percentage, 0) as deck_mastery
    FROM flashcard_decks fd
    JOIN users u ON fd.user_id = u.id
    LEFT JOIN subjects s ON fd.subject_id = s.id
    LEFT JOIN learning_analytics la ON fd.subject_id = la.subject_id AND la.user_id = ?
    WHERE fd.user_id = ? 
       OR fd.id IN (
         SELECT sd.deck_id FROM shared_decks sd
         WHERE sd.shared_to_user_id = ?
       )
       OR fd.id IN (
         SELECT fd2.id FROM flashcard_decks fd2
         JOIN subjects s2 ON fd2.subject_id = s2.id
         WHERE s2.user_id IN (
           SELECT u2.id FROM users u2
           JOIN group_memberships gm ON gm.group_pin_id = u2.share_pin
           WHERE gm.user_id = ?
         )
       )
    ORDER BY 
      (COALESCE((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.next_review_date <= CURRENT_TIMESTAMP), 0)) DESC,
      COALESCE(la.mastery_percentage, 0) ASC,
      fd.created_at DESC
  `;
  
  db.all(query, [userId, userId, userId, userId], (err, rows) => {
    if (err) {
      console.error('[FlashcardMetrics] Error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
};

/**
 * Crear un nuevo mazo de flashcards
 */
exports.createFlashcardDeck = (req, res) => {
  const { subject_id, user_id, title, description } = req.body;
  if (!title || !user_id) return res.status(400).json({ error: 'Faltan campos requeridos (user_id, title).' });
  db.run(
    `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
    [subject_id || null, user_id, title, description || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, subject_id: subject_id || null, user_id, title, description: description || '', card_count: 0 });
    }
  );
};

/**
 * Actualiza un mazo de flashcards (subject_id, title, description)
 */
exports.updateFlashcardDeck = (req, res) => {
  const { deckId } = req.params;
  const { subject_id, title, description } = req.body;

  const updateFields = [];
  const params = [];

  if (subject_id !== undefined) {
    updateFields.push('subject_id = ?');
    params.push(subject_id);
  }
  if (title !== undefined) {
    updateFields.push('title = ?');
    params.push(title);
  }
  if (description !== undefined) {
    updateFields.push('description = ?');
    params.push(description);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  params.push(deckId);

  db.run(
    `UPDATE flashcard_decks SET ${updateFields.join(', ')} WHERE id = ?`,
    params,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Mazo no encontrado' });
      res.json({ success: true, message: 'Mazo actualizado' });
    }
  );
};

// ─── Card CRUD ────────────────────────────────────────────────────────────────

/**
 * Obtener todas las tarjetas de un mazo (normalizadas al formato polimórfico)
 */
exports.getCardsByDeck = (req, res) => {
  const { deckId } = req.params;
  db.all(`SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC`, [deckId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(normalizeCard));
  });
};

/**
 * Obtiene una tarjeta específica por su ID
 */
exports.getCardById = (req, res) => {
  const { cardId } = req.params;
  db.get(`SELECT * FROM flashcards WHERE id = ?`, [cardId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    res.json(normalizeCard(row));
  });
};

/**
 * Obtiene todas las tarjetas de un mazo ordenadas por prioridad de repaso
 * Prioridad: tarjetas vencidas, dominio bajo, tasa de fallos alta
 */
exports.getCardsByDeckPrioritized = (req, res) => {
  const { deckId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }

  db.all(
    `SELECT 
       fc.*,
       CASE 
         WHEN COALESCE(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END), 0) > 0
         THEN CAST(COALESCE(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END), 0) AS FLOAT) / 
              CAST(COALESCE(COUNT(cl.id), 1) AS FLOAT)
         ELSE 0
       END as failure_rate,
       CAST(COUNT(cl.id) AS INTEGER) as total_attempts
     FROM flashcards fc
     LEFT JOIN card_logs cl ON fc.id = cl.card_id AND cl.user_id = ?
     WHERE fc.deck_id = ?
     GROUP BY fc.id
     ORDER BY 
       CASE WHEN fc.next_review_date <= CURRENT_TIMESTAMP THEN 0 ELSE 1 END ASC,
       fc.next_review_date ASC,
       failure_rate DESC,
       fc.created_at ASC`,
    [userId, deckId],
    (err, rows) => {
      if (err) {
        console.error('[CardsPrioritized] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows.map(normalizeCard));
    }
  );
};

/**
 * Crear una tarjeta legacy (front/back) — mantiene compatibilidad con FlashcardNewCardScreen
 */
exports.createCard = (req, res) => {
  const { deckId } = req.params;
  const { front, back } = req.body;
  if (!front || !back) return res.status(400).json({ error: 'Faltan campos requeridos (front, back).' });

  const contentJson = JSON.stringify({ front, back });
  
  // ── Calcular next_review_date: 7 días desde hoy ─────────────────────────
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + 7);
  const nextReviewDateStr = nextReviewDate.toISOString();
  
  db.run(
    `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, status, next_review_date, sm2_ease_factor, sm2_interval, sm2_repetitions, fsrs_stability, fsrs_difficulty, fsrs_repetitions) VALUES (?, ?, ?, 'flashcard', ?, 'new', ?, 2.5, 1, 0, 1, 0.5, 0)`,
    [deckId, front, back, contentJson, nextReviewDateStr],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json(normalizeCard({
        id: this.lastID, deck_id: Number(deckId), front, back,
        item_type: 'flashcard', content_json: contentJson, status: 'new', hint: null, explanation: null,
      }));
    }
  );
};

/**
 * Crear un ítem de evaluación polimórfico (flashcard | multiple_choice | boolean)
 * Body: { item_type, content_json: { ... }, hint?, explanation? }
 */
exports.createEvaluationItem = (req, res) => {
  const { deckId } = req.params;
  const { item_type, content_json, hint, explanation } = req.body;

  const validTypes = ['flashcard', 'multiple_choice', 'boolean'];
  if (!item_type || !validTypes.includes(item_type)) {
    return res.status(400).json({ error: `item_type debe ser uno de: ${validTypes.join(', ')}` });
  }
  if (!content_json) return res.status(400).json({ error: 'Se requiere content_json.' });

  const contentStr = typeof content_json === 'string' ? content_json : JSON.stringify(content_json);
  let parsed;
  try { parsed = JSON.parse(contentStr); } catch (_) {
    return res.status(400).json({ error: 'content_json no es JSON válido.' });
  }

  // Para flashcard legacy, extraer front/back
  const front = item_type === 'flashcard' ? (parsed.front || '') : '';
  const back = item_type === 'flashcard' ? (parsed.back || '') : '';

  // ── Calcular next_review_date: 7 días desde hoy ─────────────────────────
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + 7);
  const nextReviewDateStr = nextReviewDate.toISOString();

  db.run(
    `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, hint, explanation, status, next_review_date, sm2_ease_factor, sm2_interval, sm2_repetitions, fsrs_stability, fsrs_difficulty, fsrs_repetitions) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, 2.5, 1, 0, 1, 0.5, 0)`,
    [deckId, front, back, item_type, contentStr, hint || null, explanation || null, nextReviewDateStr],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json(normalizeCard({
        id: this.lastID, deck_id: Number(deckId), front, back,
        item_type, content_json: contentStr, hint: hint || null, explanation: explanation || null, status: 'new',
      }));
    }
  );
};

/**
 * Registrar una revisión de tarjeta con SM-2 Algorithm
 * Body: { userId, result: 'correct'|'incorrect', responseTimeMs: number }
 */
exports.recordCardReview = (req, res) => {
  const { cardId } = req.params;
  const { userId, result, responseTimeMs } = req.body;

  if (!userId || !result || typeof responseTimeMs !== 'number') {
    return res.status(400).json({ error: 'Se requieren: userId, result (correct|incorrect), responseTimeMs' });
  }

  if (!['correct', 'incorrect'].includes(result)) {
    return res.status(400).json({ error: 'result debe ser "correct" o "incorrect"' });
  }

  // Obtener FSRS actual de la tarjeta
  db.get(
    `SELECT fc.id, fc.deck_id, fc.fsrs_stability, fc.fsrs_difficulty, fc.fsrs_repetitions, fd.subject_id 
     FROM flashcards fc
     LEFT JOIN flashcard_decks fd ON fc.deck_id = fd.id
     WHERE fc.id = ?`,
    [cardId],
    (err, card) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!card) return res.status(404).json({ error: 'Tarjeta no encontrada' });

      // ── Mapear resultado a calidad FSRS (0-5) ────────────────────────────
      // result === 'correct' se mapea a quality (3-5 según tiempo)
      // result === 'incorrect' se mapea a quality < 3
      let quality = 1;
      if (result === 'correct') {
        if (responseTimeMs < 3000) quality = 5;        // Perfecto
        else if (responseTimeMs < 8000) quality = 4;   // Bueno
        else quality = 3;                              // Aceptable
      } else {
        quality = 1;                                   // Malo/Olvidado
      }

      // ── Calcular nuevo intervalo con FSRS ────────────────────────────────
      const fsrsResult = calculateFSRS({
        quality,
        stability: card.fsrs_stability || 1,
        difficulty: card.fsrs_difficulty || 0.5,
        repetitions: card.fsrs_repetitions || 0,
        interval: 1,  // Simplificado: se calcula dentro de calculateFSRS
      });

      const nextReviewDateStr = fsrsResult.nextReviewDate.toISOString();

      // ── Actualizar flashcard con nuevos valores FSRS ────────────────────
      db.run(
        `UPDATE flashcards 
         SET fsrs_stability = ?, fsrs_difficulty = ?, fsrs_repetitions = ?, 
             next_review_date = ?, status = 'review', last_review_timestamp = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [fsrsResult.newStability, fsrsResult.newDifficulty, fsrsResult.newRepetitions, nextReviewDateStr, cardId],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: updateErr.message });

          // ── Registrar en card_logs para análisis ───────────────────────
          db.run(
            `INSERT INTO card_logs (card_id, user_id, result, response_time_ms, difficulty_deduced)
             VALUES (?, ?, ?, ?, ?)`,
            [cardId, userId, result, responseTimeMs, quality >= 4 ? 'easy' : quality === 3 ? 'moderate' : 'difficult'],
            (logErr) => {
              if (logErr) console.warn('[CardLogs] Error registrando revisión:', logErr);
            }
          );

          // ── Actualizar learning_analytics ──────────────────────────────
          const isCorrect = result === 'correct' ? 1 : 0;
          db.run(
            `UPDATE learning_analytics 
             SET total_reviews = total_reviews + 1,
                 correct_reviews = correct_reviews + ?,
                 incorrect_reviews = incorrect_reviews + ?,
                 mastery_percentage = CASE 
                   WHEN total_reviews + 1 > 0 THEN ROUND((correct_reviews + ?) * 100.0 / (total_reviews + 1), 1)
                   ELSE 0
                 END,
                 last_updated = CURRENT_TIMESTAMP
             WHERE user_id = ? AND subject_id = ?`,
            [isCorrect, 1 - isCorrect, isCorrect, userId, card.subject_id || null],
            (analyticsErr) => {
              if (analyticsErr) console.warn('[Analytics] Error actualizando estadísticas:', analyticsErr);
            }
          );

          // ── Retornar resultado con métricas FSRS ────────────────────────
          res.json({
            success: true,
            cardId,
            quality,
            nextReviewDate: nextReviewDateStr,
            newStability: fsrsResult.newStability,
            newDifficulty: fsrsResult.newDifficulty,
            newRepetitions: fsrsResult.newRepetitions,
            retention: fsrsResult.retention,
            message: `Revisión registrada (FSRS). Próxima revisión en ${fsrsResult.newInterval} días. Retención esperada: ${fsrsResult.retention}%.`,
          });
        }
      );
    }
  );
};

/**
 * Actualizar el estado de una tarjeta
 */
exports.updateCardStatus = (req, res) => {
  const { cardId } = req.params;
  const { status } = req.body;
  db.run(`UPDATE flashcards SET status = ? WHERE id = ?`, [status, cardId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
};

/**
 * Eliminar una tarjeta
 */
exports.deleteCard = (req, res) => {
  const { cardId } = req.params;
  db.run(`DELETE FROM flashcards WHERE id = ?`, [cardId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
};

/**
 * Eliminar un mazo completo o quitar un mazo compartido de la lista del usuario
 */
exports.deleteDeck = (req, res) => {
  const { deckId } = req.params;
  const { user_id } = req.query;

  if (!user_id) return res.status(400).json({ error: 'Se requiere user_id para verificar permisos de eliminación.' });

  db.get(`SELECT user_id FROM flashcard_decks WHERE id = ?`, [deckId], (err, deck) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!deck) return res.status(404).json({ error: 'Mazo no encontrado.' });

    if (deck.user_id === Number(user_id)) {
      db.run(`DELETE FROM flashcards WHERE deck_id = ?`, [deckId], (errCards) => {
        if (errCards) return res.status(500).json({ error: errCards.message });
        db.run(`DELETE FROM shared_decks WHERE deck_id = ?`, [deckId], (errShared) => {
          if (errShared) return res.status(500).json({ error: errShared.message });
          db.run(`DELETE FROM flashcard_decks WHERE id = ?`, [deckId], function(errDeck) {
            if (errDeck) return res.status(500).json({ error: errDeck.message });
            res.json({ success: true, message: 'Mazo y todo su contenido eliminado permanentemente.' });
          });
        });
      });
    } else {
      db.run(
        `DELETE FROM shared_decks WHERE deck_id = ? AND shared_to_user_id = ?`,
        [deckId, user_id],
        function(errUnshare) {
          if (errUnshare) return res.status(500).json({ error: errUnshare.message });
          if (this.changes === 0) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar este mazo o no está compartido contigo.' });
          }
          res.json({ success: true, message: 'Mazo compartido quitado de tu lista exitosamente.' });
        }
      );
    }
  });
};

/**
 * Comparte un mazo con otro usuario usando su PIN
 */
exports.shareDeck = (req, res) => {
  const { deckId } = req.params;
  const { user_id, recipient_pin } = req.body;

  if (!user_id || !recipient_pin) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, recipient_pin).' });
  }

  db.get(`SELECT id, username, name FROM users WHERE share_pin = ?`, [recipient_pin.trim().toUpperCase()], (err, recipient) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!recipient) return res.status(404).json({ error: 'No se encontró ningún usuario con ese PIN.' });
    if (recipient.id === Number(user_id)) return res.status(400).json({ error: 'No puedes compartir un mazo contigo mismo.' });

    db.get(`SELECT id, title FROM flashcard_decks WHERE id = ? AND user_id = ?`, [deckId, user_id], (err2, deck) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!deck) return res.status(403).json({ error: 'No tienes permiso para compartir este mazo.' });

      db.get(`SELECT id FROM shared_decks WHERE deck_id = ? AND shared_to_user_id = ?`, [deckId, recipient.id], (checkErr, existing) => {
        if (checkErr) return res.status(500).json({ error: checkErr.message });
        if (existing) {
          return res.status(200).json({
            message: `El mazo ya estaba compartido con @${recipient.username || recipient.name}.`,
            recipient_name: recipient.name || recipient.username,
          });
        }
        db.run(
          `INSERT INTO shared_decks (deck_id, shared_by_user_id, shared_to_user_id) VALUES (?, ?, ?)`,
          [deckId, user_id, recipient.id],
          function(insertErr) {
            if (insertErr) return res.status(500).json({ error: insertErr.message });
            res.status(201).json({
              message: `Mazo "${deck.title}" compartido exitosamente con @${recipient.username || recipient.name}.`,
              recipient_name: recipient.name || recipient.username,
            });
          }
        );
      });
    });
  });
};

// ─── AI Generation ────────────────────────────────────────────────────────────

/**
 * Helper: Inserta un card en la BD de forma asíncrona
 */
function insertSingleCard(deckId, front, back, itemType, contentStr, hint, explanation, is_atomic, parent_card_id, word_count) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, hint, explanation, status, is_atomic, parent_card_id, word_count) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
      [deckId, front, back, itemType, contentStr, hint, explanation, is_atomic, parent_card_id, word_count],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

/**
 * Helper: Inserta un array de items en la BD y devuelve el mazo completo
 * ¡AHORA CON FRAGMENTACIÓN ATÓMICA AUTOMÁTICA!
 */
async function insertItemsAndReturn(res, deckId, subject_id, user_id, title, description, items) {
  try {
    for (const item of items) {
      const itemType = item.type || item.item_type || 'flashcard';
      const content = item.data || item.content || {};
      const front = itemType === 'flashcard' ? (content.front || item.question || '') : '';
      const back = itemType === 'flashcard' ? (content.back || item.answer || '') : '';
      const hint = item.hint || content.hint || null;
      const explanation = item.explanation || content.explanation || null;

      if (itemType === 'flashcard') {
        const density = analyzeCardDensity({ front, back });

        if (density.isDense) {
          console.log(`[Atomic] Fragmentando tarjeta densa: ${front.substring(0, 30)}...`);
          const parentContentStr = JSON.stringify(content);
          // Insertar padre (contenedor)
          const parentId = await insertSingleCard(deckId, front, back, itemType, parentContentStr, hint, explanation, 0, null, density.wordCount);
          
          // Generar e insertar hijas
          const atomicCards = fragmentCard({ front, back });
          for (let i = 0; i < atomicCards.length; i++) {
            const atomic = atomicCards[i];
            const childContentStr = JSON.stringify({ front: atomic.front, back: atomic.back });
            const childWordCount = atomic.back.split(/\s+/).length;
            // Se asume is_atomic = 1
            await insertSingleCard(deckId, atomic.front, atomic.back, itemType, childContentStr, hint, explanation, 1, parentId, childWordCount);
          }
        } else {
          // Tarjeta normal
          const contentStr = JSON.stringify(content);
          await insertSingleCard(deckId, front, back, itemType, contentStr, hint, explanation, 1, null, density.wordCount);
        }
      } else {
        // multiple_choice o boolean, no las fragmentamos por ahora
        const contentStr = JSON.stringify(content);
        await insertSingleCard(deckId, front, back, itemType, contentStr, hint, explanation, 1, null, 20);
      }
    }

    db.all(`SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC`, [deckId], (err, cards) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: deckId, subject_id, user_id, title, description,
        card_count: cards.length,
        cards: cards.map(normalizeCard),
      });
    });

  } catch (err) {
    db.run(`DELETE FROM flashcard_decks WHERE id = ?`, [deckId], () => {
      res.status(500).json({ error: 'Error al insertar ítems, mazo revertido', details: err.message });
    });
  }
}

/**
 * Construye el system prompt del LLM según el modo de generación.
 * mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed'
 */
function buildSystemPrompt(mode, count) {
  const base = `Actúa como un experto en pedagogía universitaria y diseño instruccional.
Paso Previo: Analiza el texto, extrae los conceptos técnicos clave y descarta información irrelevante.

CALIDAD ACADÉMICA Y REGLAS DE ORO:
1. RIGOR: Usa terminología técnica precisa del texto. Si detectas que el usuario solicita temas relacionados (ej: "incluye hantavirus" cuando el texto trata sobre coronavirus), PUEDES incorporarlos como temas complementarios que enriquecen el aprendizaje académico.
2. NO CIRCULARIDAD: La explicación JAMÁS debe ser una paráfrasis de la pregunta o respuesta. Debe aportar el "por qué" conceptual o un ejemplo de aplicación.
3. PISTAS (HINTS): Debe ser un andamiaje cognitivo (sugerir una ruta de pensamiento), no una respuesta parcial ni letras iniciales.
4. DISTRACTORES DE CALIDAD: Cada opción incorrecta debe nacer de un error de razonamiento específico (ej. mala aplicación de una fórmula, confusión de conceptos similares o generalización excesiva). No rellenes con opciones aleatorias.
5. EXCLUSIVIDAD SEMÁNTICA: En selección múltiple, las 4 opciones deben tener contenido semántico único. Estrictamente PROHIBIDO que dos opciones representen el mismo concepto o respuesta, incluso con palabras distintas.`;

  if (mode === 'flashcard') {
    return `${base}

Genera exactamente ${count} FLASHCARDS en formato JSON array.
- Front: Pregunta conceptual que obligue a pensar.
- Back: Respuesta técnica y completa en máximo 3 oraciones.
- Explanation: Profundización teórica o ejemplo de aplicación.
Formato: [{ "type": "flashcard", "data": { "front": "...", "back": "..." }, "hint": "...", "explanation": "..." }]`;
  }

  if (mode === 'multiple_choice') {
    return `${base}

Genera exactamente ${count} PREGUNTAS DE SELECCIÓN MÚLTIPLE (estilo ECAES/SABER PRO) en formato JSON array.
- Opciones: Exactamente 4 opciones ÚNICAS. PROHIBIDO repetir opciones.
- Distractores: Deben ser plausibles y basados en errores comunes.
- Explanation: Justifica la opción correcta y explica por qué los distractores fallan.
Formato: [{ "type": "multiple_choice", "data": { "question": "...", "options": ["A","B","C","D"], "correctIndex": N }, "hint": "...", "explanation": "..." }]`;
  }

  if (mode === 'boolean') {
    return `${base}

Genera exactamente ${count} PREGUNTAS DE VERDADERO O FALSO en formato JSON array.
- Question: Afirmaciones con matices técnicos que desafíen la comprensión.
- Explanation: Argumento sólido que respalde la veracidad o falsedad basándose en el texto.
Formato: [{ "type": "boolean", "data": { "question": "...", "correctAnswer": true/false }, "hint": "...", "explanation": "..." }]`;
  }

  if (mode === 'mixed') {
    return `${base}

Genera exactamente ${count} ÍTEMS MIXTOS (40% Flashcards, 40% Selección Múltiple, 20% V/F) en formato JSON array.
Sigue estrictamente estos esquemas según el tipo:

- Flashcard: { "type": "flashcard", "data": { "front": "...", "back": "..." }, "hint": "...", "explanation": "..." }
- Selección Múltiple: { "type": "multiple_choice", "data": { "question": "...", "options": ["A","B","C","D"], "correctIndex": N }, "hint": "...", "explanation": "..." }
- Verdadero/Falso: { "type": "boolean", "data": { "question": "...", "correctAnswer": true/false }, "hint": "...", "explanation": "..." }

Responde ÚNICAMENTE con el array JSON, sin texto introductorio ni conclusiones.`;
  }

  return `${base}

Genera exactamente ${count} ítems de tipo "${mode}" en formato JSON array.
Responde ÚNICAMENTE con el array JSON, sin texto introductorio ni conclusiones.`;
}

/**
 * Genera un mazo a partir de texto usando Groq.
 * Soporta mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed'
 */
exports.generateDeckFromText = async (req, res) => {
  const { text, count, title, subject_id, user_id, mode = 'flashcard' } = req.body;

  if (!text || !count || !title || !subject_id || !user_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (text, count, title, subject_id, user_id).' });
  }

  const groqApiKey = secrets.GROQ_API_KEY;
  if (!groqApiKey) return res.status(500).json({ error: 'Groq API Key no está configurada' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: buildSystemPrompt(mode, count) },
          { role: 'user', content: `Genera exactamente ${count} ítems basados en este contenido:\n\n${text}` }
        ],
        temperature: 0.2,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: 'Error al llamar a Groq API', details: errorData });
    }

    const groqData = await response.json();
    const raw = groqData.choices[0].message.content.trim();

    // Extraer el JSON array de la respuesta
    let jsonString = raw;
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonString = arrayMatch[0];

    let items;
    try { items = JSON.parse(jsonString); }
    catch (parseError) {
      return res.status(500).json({ error: 'Respuesta de Groq no es JSON válido', details: raw });
    }

    if (!Array.isArray(items)) {
      // Compatibilidad con respuesta antigua tipo { flashcards: [...] }
      if (items.flashcards) items = items.flashcards.map(c => ({ type: 'flashcard', data: { front: c.question || c.front, back: c.answer || c.back } }));
      else return res.status(500).json({ error: 'Estructura de respuesta inválida' });
    }

    const description = `Mazo ${mode === 'mixed' ? 'mixto' : mode} generado con IA`;
    db.run(
      `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
      [subject_id, user_id, title, description],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        insertItemsAndReturn(res, this.lastID, subject_id, user_id, title, description, items);
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Error al generar ítems', details: err.message });
  }
};

/**
 * Genera un mazo a partir de una imagen (OCR + Groq Vision).
 * Soporta mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed'
 */
exports.generateDeckFromImage = async (req, res) => {
  const { image_base64, count, title, subject_id, user_id, mode = 'flashcard' } = req.body;

  if (!image_base64 || !count || !title || !subject_id || !user_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (image_base64, count, title, subject_id, user_id).' });
  }

  const groqApiKey = secrets.GROQ_API_KEY;
  if (!groqApiKey) return res.status(500).json({ error: 'Groq API Key no está configurada' });

  let formattedBase64 = image_base64;
  if (!image_base64.startsWith('data:image')) {
    formattedBase64 = `data:image/jpeg;base64,${image_base64}`;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `Eres un experto en OCR académico y pedagogía.\n1. Transcribe mentalmente la imagen ignorando ruido visual.\n2. A partir de esa información, genera ítems de evaluación de NIVEL UNIVERSITARIO.\n\n${buildSystemPrompt(mode, count)}\n\nGenera exactamente ${count} ítems basados en la imagen.` },
            { type: 'image_url', image_url: { url: formattedBase64 } }
          ]
        }],
        temperature: 0.2,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: 'Error al llamar a Groq Vision API', details: errorData });
    }

    const groqData = await response.json();
    const raw = groqData.choices[0].message.content.trim();

    let jsonString = raw;
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonString = arrayMatch[0];

    let items;
    try { items = JSON.parse(jsonString); }
    catch (_) {
      return res.status(500).json({ error: 'Respuesta de Groq Vision no es JSON válido', details: raw });
    }

    if (!Array.isArray(items)) {
      if (items.flashcards) items = items.flashcards.map(c => ({ type: 'flashcard', data: { front: c.question || c.front, back: c.answer || c.back } }));
      else return res.status(500).json({ error: 'Estructura de respuesta inválida' });
    }

    const description = `Mazo ${mode === 'mixed' ? 'mixto' : mode} generado con OCR + IA`;
    db.run(
      `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
      [subject_id, user_id, title, description],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        insertItemsAndReturn(res, this.lastID, subject_id, user_id, title, description, items);
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Error al generar ítems con OCR', details: err.message });
  }
};

/**
 * Analiza confusiones en un mazo: detecta tarjetas que frecuentemente generan errores similares
 * Retorna sugerencias de diferenciación entre conceptos
 */
exports.analyzeDeckConfusions = (req, res) => {
  const { deckId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }

  // Paso 1: Obtener todas las tarjetas del mazo con su tasa de fallos
  db.all(
    `SELECT 
       fc.id,
       fc.deck_id,
       fc.front,
       fc.back,
       fc.content_json,
       CASE 
         WHEN COUNT(cl.id) > 0
         THEN CAST(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(cl.id)
         ELSE 0
       END as failure_rate,
       COUNT(cl.id) as attempts
     FROM flashcards fc
     LEFT JOIN card_logs cl ON fc.id = cl.card_id AND cl.user_id = ?
     WHERE fc.deck_id = ?
     GROUP BY fc.id
     HAVING attempts > 0
     ORDER BY failure_rate DESC`,
    [userId, deckId],
    (err, cards) => {
      if (err) {
        console.error('[AnalyzeConfusions] Error:', err);
        return res.status(500).json({ error: err.message });
      }

      if (!cards || cards.length < 2) {
        return res.json({ confusions: [], message: 'No hay suficientes tarjetas con intentos para analizar confusiones' });
      }

      // Paso 2: Detectar tarjetas problemáticas (failure_rate > 0.3)
      const problematicCards = cards.filter(c => c.failure_rate > 0.3);

      if (problematicCards.length < 2) {
        return res.json({ confusions: [], message: 'No hay suficientes tarjetas problemáticas' });
      }

      // Paso 3: Para cada par de tarjetas problemáticas, calcular correlación de errores
      const confusions = [];

      for (let i = 0; i < problematicCards.length; i++) {
        for (let j = i + 1; j < problematicCards.length; j++) {
          const card1 = problematicCards[i];
          const card2 = problematicCards[j];

          // Buscar usuarios que cometieron errores en ambas tarjetas
          db.all(
            `SELECT 
               cl1.user_id,
               SUM(CASE WHEN cl1.result = 'incorrect' THEN 1 ELSE 0 END) as errors_card1,
               SUM(CASE WHEN cl2.result = 'incorrect' THEN 1 ELSE 0 END) as errors_card2,
               COUNT(DISTINCT cl1.user_id) as shared_users
             FROM card_logs cl1
             INNER JOIN card_logs cl2 ON cl1.user_id = cl2.user_id
             WHERE cl1.card_id = ? AND cl2.card_id = ? AND cl1.user_id = ?
             GROUP BY cl1.user_id`,
            [card1.id, card2.id, userId],
            (correlErr, correlation) => {
              if (!correlErr && correlation && correlation.length > 0) {
                const corr = correlation[0];
                if (corr.errors_card1 >= 2 && corr.errors_card2 >= 2) {
                  // Hay correlación: este usuario falla en ambas
                  confusions.push({
                    card1_id: card1.id,
                    card1_preview: card1.front || (card1.content_json ? JSON.parse(card1.content_json).front : ''),
                    card1_failure_rate: card1.failure_rate,
                    card2_id: card2.id,
                    card2_preview: card2.front || (card2.content_json ? JSON.parse(card2.content_json).front : ''),
                    card2_failure_rate: card2.failure_rate,
                    common_errors: corr.errors_card1 + corr.errors_card2,
                    confidence: (corr.errors_card1 + corr.errors_card2) / (card1.attempts + card2.attempts),
                  });
                }
              }
            }
          );
        }
      }

      // Enviar respuesta con un pequeño delay para que las queries correlacionadas se completen
      setTimeout(() => {
        res.json({
          confusions: confusions.slice(0, 5), // Top 5 confusiones
          total_problematic: problematicCards.length,
          message: `Detectadas ${confusions.length} pares de tarjetas con confusiones potenciales`,
        });
      }, 500);
    }
  );
};

/**
 * Genera una tarjeta de diferenciación entre dos conceptos
 * Requiere Groq API para generar contenido
 */
exports.generateDifferentiationCard = (req, res) => {
  const { deckId } = req.params;
  const { card1_id, card2_id, userId } = req.body;

  if (!card1_id || !card2_id || !userId) {
    return res.status(400).json({ error: 'Se requieren: card1_id, card2_id, userId' });
  }

  // Obtener ambas tarjetas
  db.all(
    `SELECT id, front, back, content_json, item_type FROM flashcards WHERE id IN (?, ?)`,
    [card1_id, card2_id],
    async (err, cards) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!cards || cards.length !== 2) {
        return res.status(404).json({ error: 'Una o ambas tarjetas no fueron encontradas' });
      }

      const card1 = cards[0];
      const card2 = cards[1];

      // Extraer front/back para ambas tarjetas
      let content1 = { front: card1.front || '', back: card1.back || '' };
      let content2 = { front: card2.front || '', back: card2.back || '' };

      if (card1.content_json) {
        try { content1 = JSON.parse(card1.content_json); } catch (_) {}
      }
      if (card2.content_json) {
        try { content2 = JSON.parse(card2.content_json); } catch (_) {}
      }

      const groqApiKey = secrets.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({ error: 'Groq API Key no está configurada' });
      }

      try {
        const prompt = `Eres un experto en pedagogía y diferenciación conceptual.

El usuario está confundiendo dos conceptos en sus estudios:

**Concepto A:**
Pregunta: ${content1.front}
Respuesta: ${content1.back}

**Concepto B:**
Pregunta: ${content2.front}
Respuesta: ${content2.back}

Genera UNA tarjeta de diferenciación clara que ayude al usuario a distinguir estos dos conceptos.
La tarjeta debe:
1. Resaltar las diferencias clave
2. Usar ejemplos contrastantes
3. Ser memorable y concisa

Responde SOLO con un JSON válido en este formato:
{
  "front": "pregunta de diferenciación",
  "back": "explicación que destaca diferencias"
}`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mixtral-8x7b-32768',
            messages: [{
              role: 'user',
              content: prompt,
            }],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          return res.status(500).json({
            error: 'Error al llamar a Groq API',
            details: errorData,
          });
        }

        const groqData = await response.json();
        const raw = groqData.choices[0].message.content.trim();

        let diffCard;
        try {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : raw;
          diffCard = JSON.parse(jsonStr);
        } catch (_) {
          return res.status(500).json({
            error: 'Respuesta de Groq no es JSON válido',
            details: raw,
          });
        }

        if (!diffCard.front || !diffCard.back) {
          return res.status(500).json({ error: 'Tarjeta generada incompleta' });
        }

        // Crear la tarjeta de diferenciación en el mazo
        db.get(
          `SELECT deck_id FROM flashcards WHERE id = ?`,
          [card1_id],
          (getErr, card) => {
            if (getErr) return res.status(500).json({ error: getErr.message });

            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + 3); // Revisión en 3 días
            const nextReviewDateStr = nextReviewDate.toISOString();

            const contentJson = JSON.stringify(diffCard);

            db.run(
              `INSERT INTO flashcards (
                deck_id, front, back, item_type, content_json, hint, explanation,
                status, next_review_date, sm2_ease_factor, sm2_interval, sm2_repetitions,
                fsrs_stability, fsrs_difficulty, fsrs_repetitions
              ) VALUES (?, ?, ?, 'flashcard', ?, ?, ?, 'new', ?, 2.5, 1, 0, 1, 0.5, 0)`,
              [
                card.deck_id,
                diffCard.front,
                diffCard.back,
                contentJson,
                `Diferenciación entre tarjetas ${card1_id} y ${card2_id}`,
                'Estudia esta tarjeta para evitar confundir estos conceptos',
                nextReviewDateStr,
              ],
              function(insertErr) {
                if (insertErr) {
                  return res.status(500).json({ error: insertErr.message });
                }

                res.status(201).json({
                  success: true,
                  newCardId: this.lastID,
                  front: diffCard.front,
                  back: diffCard.back,
                  message: 'Tarjeta de diferenciación creada exitosamente',
                });
              }
            );
          }
        );
      } catch (err) {
        res.status(500).json({
          error: 'Error generando tarjeta de diferenciación',
          details: err.message,
        });
      }
    }
  );
};

// ─── Snooze Management ─────────────────────────────────────────────────────────

/**
 * POST /api/flashcards/:cardId/snooze
 * Snooze a single card for a specified duration (in minutes)
 * Body: { userId, durationMinutes, reason? }
 */
exports.snoozeCard = (req, res) => {
  const { cardId } = req.params;
  const { userId, durationMinutes, reason } = req.body;

  if (!userId || !durationMinutes || durationMinutes <= 0) {
    return res.status(400).json({ error: 'Se requieren: userId, durationMinutes (> 0)' });
  }

  // Calculate resume time
  const now = new Date();
  const resumeAt = new Date(now.getTime() + durationMinutes * 60000);
  const resumeAtStr = resumeAt.toISOString();

  // Insert or replace snooze record
  db.run(
    `INSERT INTO card_snoozes (card_id, user_id, snoozed_at, resume_at, snooze_duration_minutes, reason)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
     ON CONFLICT(card_id) DO UPDATE SET
       user_id = ?,
       snoozed_at = CURRENT_TIMESTAMP,
       resume_at = ?,
       snooze_duration_minutes = ?,
       reason = ?`,
    [cardId, userId, resumeAtStr, durationMinutes, reason || null, userId, resumeAtStr, durationMinutes, reason || null],
    function(err) {
      if (err) {
        console.error('[Snooze] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        cardId,
        snoozedUntil: resumeAtStr,
        durationMinutes,
        message: `Tarjeta snoozed por ${durationMinutes} minutos`,
      });
    }
  );
};

/**
 * DELETE /api/flashcards/:cardId/snooze
 * Resume a snoozed card (remove snooze)
 */
exports.unsnoozeCard = (req, res) => {
  const { cardId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }

  db.run(
    `DELETE FROM card_snoozes WHERE card_id = ? AND user_id = ?`,
    [cardId, userId],
    function(err) {
      if (err) {
        console.error('[Unsnooze] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Snooze no encontrado para esta tarjeta' });
      }
      res.json({
        success: true,
        cardId,
        message: 'Tarjeta reanudada',
      });
    }
  );
};

/**
 * GET /api/flashcards/:cardId/snooze-status
 * Check if a card is snoozed and when it will resume
 */
exports.getSnoozeStatus = (req, res) => {
  const { cardId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }

  const now = new Date().toISOString();

  db.get(
    `SELECT 
       id, card_id, resume_at, snooze_duration_minutes, reason,
       CASE WHEN resume_at <= ? THEN 1 ELSE 0 END as is_expired
     FROM card_snoozes
     WHERE card_id = ? AND user_id = ?`,
    [now, cardId, userId],
    (err, row) => {
      if (err) {
        console.error('[SnoozeStatus] Error:', err);
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        return res.json({ isSnoozed: false, cardId });
      }

      // If snooze expired, delete it
      if (row.is_expired) {
        db.run(`DELETE FROM card_snoozes WHERE id = ?`, [row.id], (deleteErr) => {
          if (deleteErr) console.warn('[SnoozeStatus] Error deleting expired snooze:', deleteErr);
        });
        return res.json({ isSnoozed: false, cardId, wasExpired: true });
      }

      res.json({
        isSnoozed: true,
        cardId,
        resumeAt: row.resume_at,
        durationMinutes: row.snooze_duration_minutes,
        reason: row.reason,
        timeUntilResume: Math.max(0, Math.ceil((new Date(row.resume_at) - new Date()) / 60000)), // minutes
      });
    }
  );
};

/**
 * GET /api/flashcard-decks/:deckId/cards/not-snoozed
 * Get all cards in a deck, excluding snoozed cards
 */
exports.getCardsNotSnoozed = (req, res) => {
  const { deckId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }

  const now = new Date().toISOString();

  db.all(
    `SELECT 
       fc.*,
       CASE 
         WHEN COALESCE(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END), 0) > 0
         THEN CAST(COALESCE(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END), 0) AS FLOAT) / 
              CAST(COALESCE(COUNT(cl.id), 1) AS FLOAT)
         ELSE 0
       END as failure_rate,
       CAST(COUNT(cl.id) AS INTEGER) as total_attempts
     FROM flashcards fc
     LEFT JOIN card_logs cl ON fc.id = cl.card_id AND cl.user_id = ?
     LEFT JOIN card_snoozes cs ON fc.id = cs.card_id AND cs.user_id = ? AND cs.resume_at > ?
     WHERE fc.deck_id = ? AND cs.id IS NULL
     GROUP BY fc.id
     ORDER BY 
       CASE WHEN fc.next_review_date <= ? THEN 0 ELSE 1 END ASC,
       fc.next_review_date ASC,
       failure_rate DESC,
       fc.created_at ASC`,
    [userId, userId, now, deckId, now],
    (err, rows) => {
      if (err) {
        console.error('[CardsNotSnoozed] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows.map(normalizeCard));
    }
  );
};

/**
 * POST /api/flashcards/auto-unsnooza
 * Auto-resume all expired snoozed cards for a user
 */
exports.autoUnsnoozeExpired = (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }

  const now = new Date().toISOString();

  db.run(
    `DELETE FROM card_snoozes WHERE user_id = ? AND resume_at <= ?`,
    [userId, now],
    function(err) {
      if (err) {
        console.error('[AutoUnsnoozed] Error:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: `${this.changes} tarjetas snoozed han sido reanudadas automáticamente`,
        resumedCount: this.changes,
      });
    }
  );
};
