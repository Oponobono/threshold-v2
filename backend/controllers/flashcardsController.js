const secrets = require('../config/secrets');
const { db } = require('../db');
const { analyzeCardDensity, fragmentCard } = require('../utils/atomicCardGenerator');

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
    JOIN subjects s ON fd.subject_id = s.id
    JOIN users u ON fd.user_id = u.id
    WHERE s.user_id = ? 
       OR s.user_id IN (
         SELECT u2.id FROM users u2
         JOIN group_memberships gm ON gm.group_pin_id = u2.share_pin
         WHERE gm.user_id = ?
       )
       OR fd.id IN (
         SELECT sd.deck_id FROM shared_decks sd
         WHERE sd.shared_to_user_id = ?
       )
    ORDER BY fd.created_at DESC
  `;
  db.all(query, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Crear un nuevo mazo de flashcards
 */
exports.createFlashcardDeck = (req, res) => {
  const { subject_id, user_id, title, description } = req.body;
  if (!subject_id || !title || !user_id) return res.status(400).json({ error: 'Faltan campos requeridos (subject_id, user_id, title).' });
  db.run(
    `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
    [subject_id, user_id, title, description || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, subject_id, user_id, title, description: description || '', card_count: 0 });
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
 * Crear una tarjeta legacy (front/back) — mantiene compatibilidad con FlashcardNewCardScreen
 */
exports.createCard = (req, res) => {
  const { deckId } = req.params;
  const { front, back } = req.body;
  if (!front || !back) return res.status(400).json({ error: 'Faltan campos requeridos (front, back).' });

  const contentJson = JSON.stringify({ front, back });
  db.run(
    `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, status) VALUES (?, ?, ?, 'flashcard', ?, 'new')`,
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

  db.run(
    `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, hint, explanation, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
    [deckId, front, back, item_type, contentStr, hint || null, explanation || null],
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
1. RIGOR: Usa terminología técnica precisa del texto.
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
