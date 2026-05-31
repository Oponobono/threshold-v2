import re

with open('backend/controllers/flashcardsController.js', 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find('exports.updateFlashcardDeck = (req, res) => {')
end_idx = content.find(' * FIX: La eliminación en cascada manual', start_idx)

missing_block = r"""exports.updateFlashcardDeck = (req, res) => {
  const { deckId } = req.params;
  const { subject_id, title, description } = req.body;
  const userId = req.user.id;

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

  params.push(deckId, userId);

  db.run(
    `UPDATE flashcard_decks SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`,
    params,
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Mazo no encontrado o sin permisos' });
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
       CASE fc.status 
         WHEN 'learning' THEN 0 
         WHEN 'new' THEN 1 
         WHEN 'review' THEN 2 
         ELSE 3 
       END ASC,
       fc.fsrs_difficulty DESC,
       failure_rate DESC,
       fc.next_review_date ASC,
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
  
  db.run(
    `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, status, sm2_ease_factor, sm2_interval, sm2_repetitions, fsrs_stability, fsrs_difficulty, fsrs_repetitions) VALUES (?, ?, ?, 'flashcard', ?, 'new', 2.5, 1, 0, 1, 0.5, 0)`,
    [deckId, front, back, contentJson],
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
 * Valida que el content_json tenga la estructura correcta según su tipo.
 */
function validateContentSchema(itemType, data) {
  if (!data || typeof data !== 'object') return 'content_json debe ser un objeto';
  switch (itemType) {
    case 'flashcard':
      if (!data.front || typeof data.front !== 'string') return 'flashcard requiere front (string)';
      if (!data.back || typeof data.back !== 'string') return 'flashcard requiere back (string)';
      break;
    case 'multiple_choice':
      if (!data.question || typeof data.question !== 'string') return 'multiple_choice requiere question (string)';
      if (!Array.isArray(data.options)) return 'multiple_choice requiere options (array)';
      if (typeof data.correctIndex !== 'number') return 'multiple_choice requiere correctIndex (entero)';
      break;
    case 'boolean':
      if (!data.question || typeof data.question !== 'string') return 'boolean requiere question (string)';
      if (typeof data.correctAnswer !== 'boolean') return 'boolean requiere correctAnswer (true/false)';
      break;
  }
  return null;
}

/**
 * Sanitiza un objeto eliminando claves peligrosas
 */
function sanitizeJSON(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeJSON);
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    sanitized[key] = typeof obj[key] === 'object' && obj[key] !== null ? sanitizeJSON(obj[key]) : obj[key];
  }
  return sanitized;
}

/**
 * Crear un ítem de evaluación polimórfico
 */
exports.createEvaluationItem = (req, res) => {
  const { deckId } = req.params;
  const { item_type, content_json, hint, explanation } = req.body;

  const validTypes = ['flashcard', 'multiple_choice', 'boolean'];
  if (!item_type || !validTypes.includes(item_type)) return res.status(400).json({ error: 'invalid item_type' });
  if (!content_json) return res.status(400).json({ error: 'Se requiere content_json.' });

  const safeContent = sanitizeJSON(content_json);
  const contentStr = typeof safeContent === 'string' ? safeContent : JSON.stringify(safeContent);
  let parsed;
  try { parsed = JSON.parse(contentStr); } catch (_) { return res.status(400).json({ error: 'invalid json' }); }

  db.get(`SELECT id, user_id FROM flashcard_decks WHERE id = ?`, [deckId], (err, deck) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!deck) return res.status(404).json({ error: 'Mazo no encontrado' });
    if (deck.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    db.get(`SELECT COUNT(*) AS count FROM flashcards WHERE deck_id = ?`, [deckId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const front = item_type === 'flashcard' ? (parsed.front || '') : '';
      const back = item_type === 'flashcard' ? (parsed.back || '') : '';

      db.run(
        `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, hint, explanation, status, sm2_ease_factor, sm2_interval, sm2_repetitions, fsrs_stability, fsrs_difficulty, fsrs_repetitions) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 2.5, 1, 0, 1, 0.5, 0)`,
        [deckId, front, back, item_type, contentStr, hint || null, explanation || null],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json(normalizeCard({
            id: this.lastID, deck_id: Number(deckId), front, back,
            item_type, content_json: contentStr, hint: hint || null, explanation: explanation || null, status: 'new',
          }));
        }
      );
    });
  });
};

/**
 * Registrar una revisión de tarjeta con FSRS
 */
exports.recordCardReview = (req, res) => {
  const { cardId } = req.params;
  const { userId, result, responseTimeMs } = req.body;

  if (!userId || !result || typeof responseTimeMs !== 'number') {
    return res.status(400).json({ error: 'Missing params' });
  }

  db.get(`SELECT fc.*, fd.subject_id FROM flashcards fc LEFT JOIN flashcard_decks fd ON fc.deck_id = fd.id WHERE fc.id = ?`, [cardId], (err, card) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    let quality = 1;
    if (result === 'correct') {
      quality = responseTimeMs < 3000 ? 5 : (responseTimeMs < 8000 ? 4 : 3);
    }

    const fsrsResult = calculateFSRS({
      quality, stability: card.fsrs_stability || 1, difficulty: card.fsrs_difficulty || 0.5,
      repetitions: card.fsrs_repetitions || 0, interval: 1
    });

    db.run(
      `UPDATE flashcards SET fsrs_stability = ?, fsrs_difficulty = ?, fsrs_repetitions = ?, next_review_date = ?, status = 'review', last_review_timestamp = CURRENT_TIMESTAMP WHERE id = ?`,
      [fsrsResult.newStability, fsrsResult.newDifficulty, fsrsResult.newRepetitions, fsrsResult.nextReviewDate.toISOString(), cardId],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        res.json({ success: true, cardId, quality });
      }
    );
  });
};

/**
 * Actualizar el estado de una tarjeta
 */
exports.updateCardStatus = (req, res) => {
  const { cardId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;
  db.run(`UPDATE flashcards SET status = ? WHERE id = ? AND deck_id IN (SELECT id FROM flashcard_decks WHERE user_id = ?)`, [status, cardId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarjeta no encontrada o acceso denegado' });
    res.json({ success: true });
  });
};

/**
 * Eliminar una tarjeta
 */
exports.deleteCard = (req, res) => {
  const { cardId } = req.params;
  const userId = req.user.id;
  db.run(`DELETE FROM flashcards WHERE id = ? AND deck_id IN (SELECT id FROM flashcard_decks WHERE user_id = ?)`, [cardId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarjeta no encontrada o acceso denegado' });
    res.json({ success: true });
  });
};

/**
 * Eliminar un mazo completo o quitar un mazo compartido de la lista del usuario.
"""

if start_idx != -1 and end_idx != -1:
    first_part = content[:start_idx]
    last_part = content[end_idx:]
    
    stray_idx = last_part.find('exports.updateFlashcardDeck = (req, res) => {')
    if stray_idx != -1:
        stray_start = last_part.rfind('  );\n};\n', 0, stray_idx)
        if stray_start != -1:
            last_part = last_part[:stray_start]
        else:
            last_part = last_part[:stray_idx]

    new_content = first_part + missing_block + last_part
    with open('backend/controllers/flashcardsController.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('File successfully restored!')
else:
    print('Could not find start_idx or end_idx')
