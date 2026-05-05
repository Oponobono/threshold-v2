const { db } = require('../db');

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
    CAST((SELECT COUNT(*) FROM flashcards fc WHERE fc.deck_id = fd.id AND fc.status = 'new') AS INTEGER) as new_count
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

/**
 * Obtener todas las tarjetas de un mazo
 */
exports.getCardsByDeck = (req, res) => {
  const { deckId } = req.params;
  db.all(`SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC`, [deckId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Crear una nueva tarjeta en un mazo
 */
exports.createCard = (req, res) => {
  const { deckId } = req.params;
  const { front, back } = req.body;
  if (!front || !back) return res.status(400).json({ error: 'Faltan campos requeridos (front, back).' });
  db.run(
    `INSERT INTO flashcards (deck_id, front, back, status) VALUES (?, ?, ?, 'new')`,
    [deckId, front, back],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, deck_id: Number(deckId), front, back, status: 'new' });
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
 * Eliminar un mazo completo y sus tarjetas
 */
exports.deleteDeck = (req, res) => {
  const { deckId } = req.params;
  db.run(`DELETE FROM flashcards WHERE deck_id = ?`, [deckId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run(`DELETE FROM flashcard_decks WHERE id = ?`, [deckId], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
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

/**
 * Genera un mazo de flashcards a partir de un texto usando IA (Groq)
 */
exports.generateDeckFromText = async (req, res) => {
  const { text, count, title, subject_id, user_id } = req.body;
  
  if (!text || !count || !title || !subject_id || !user_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (text, count, title, subject_id, user_id).' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ error: 'Groq API Key no está configurada' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `Actúa como un experto en pedagogía universitaria y especialista en técnicas de estudio de alto rendimiento (Active Recall y Spaced Repetition).

Tu tarea es analizar el texto proporcionado y extraer los conceptos más importantes para crear tarjetas de repaso de NIVEL UNIVERSITARIO.

Paso Previo Obligatorio: "Limpia" mentalmente el texto. Ignora muletillas, errores de transcripción, saludos y divagaciones innecesarias antes de extraer la información.

Reglas de Oro:
1. Profundidad Académica: Cero trivia. Enfócate en mecanismos subyacentes, causas, y consecuencias.
2. Principio de Atomicidad: Cada tarjeta debe cubrir UN solo concepto o idea para facilitar el repaso espaciado. No mezcles varios temas en una sola respuesta. Si un mecanismo es complejo, divídelo en varias tarjetas que conecten entre sí.
3. Formato de Pregunta: Usa preguntas abiertas que desafíen la comprensión (Ej: "¿De qué manera el factor X influye en el proceso Y?") en lugar de completar frases o buscar datos simples.
4. Respuestas Técnicas: Máximo 2 oraciones, usando terminología precisa del texto. Deben explicar el concepto claramente.
5. Calidad sobre Cantidad: Si el texto no tiene suficiente información para el número de tarjetas solicitado, genera solo las que sean posibles con alta calidad y rigor académico.

Formato de Salida (ESTRICTO):
Responde ÚNICAMENTE con el objeto JSON. Sin introducciones, sin explicaciones, sin bloques de código markdown.
{
  "deck_metadata": { "suggested_title": "Título corto y alusivo" },
  "flashcards": [
    { "question": "...", "answer": "..." }
  ]
}`
          },
          {
            role: 'user',
            content: `Genera exactamente ${count} tarjetas basadas en este contenido: ${text}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: 'Error al llamar a Groq API', details: errorData });
    }

    const groqData = await response.json();
    const groqResponse = groqData.choices[0].message.content.trim();

    // Extraer solo la parte JSON usando regex
    let jsonString = groqResponse;
    const jsonMatch = groqResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }
    jsonString = jsonString.trim();

    // Parsear la respuesta JSON de Groq
    let cardsData;
    try {
      cardsData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return res.status(500).json({ 
        error: 'Respuesta de Groq no es JSON válido', 
        details: groqResponse,
        parseError: parseError.message 
      });
    }

    // Validar estructura
    if (!cardsData.flashcards || !Array.isArray(cardsData.flashcards)) {
      return res.status(500).json({ error: 'Estructura de respuesta de Groq inválida' });
    }

    // Crear el mazo
    db.run(
      `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
      [subject_id, user_id, title, 'Mazo generado con IA'],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        const deckId = this.lastID;

        // Crear promesas para cada inserción
        const insertPromises = cardsData.flashcards.map((card) => {
          return new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO flashcards (deck_id, front, back, status) VALUES (?, ?, ?, 'new')`,
              [deckId, card.question || card.front, card.answer || card.back],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });

        // Esperar a que TODAS las tarjetas se inserten
        Promise.all(insertPromises)
          .then(() => {
            // Retornar el mazo con sus tarjetas
            db.all(
              `SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC`,
              [deckId],
              (err, cards) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({
                  id: deckId,
                  subject_id,
                  user_id,
                  title,
                  description: 'Mazo generado con IA',
                  card_count: cards.length,
                  cards: cards
                });
              }
            );
          })
          .catch((err) => {
            // Manual Rollback: Eliminar el mazo vacío si fallan las inserciones
            db.run(`DELETE FROM flashcard_decks WHERE id = ?`, [deckId], () => {
              res.status(500).json({ error: 'Error al insertar tarjetas, mazo revertido', details: err.message });
            });
          });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Error al generar tarjetas', details: err.message });
  }
};

/**
 * Genera un mazo de flashcards a partir de una imagen (OCR + IA) usando Groq Vision
 */
exports.generateDeckFromImage = async (req, res) => {
  const { image_base64, count, title, subject_id, user_id } = req.body;
  
  if (!image_base64 || !count || !title || !subject_id || !user_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (image_base64, count, title, subject_id, user_id).' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ error: 'Groq API Key no está configurada' });
  }

  let formattedBase64 = image_base64;
  if (!image_base64.startsWith('data:image')) {
    formattedBase64 = `data:image/jpeg;base64,${image_base64}`;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Eres un experto en OCR académico y pedagogía. 

1. Transcribe mentalmente la imagen e ignora el "ruido" visual o posibles errores de captura.
2. A partir de esa información limpia, genera tarjetas de estudio de NIVEL UNIVERSITARIO.

Reglas de Oro:
1. Profundidad Académica: Cero trivia. Enfócate en mecanismos, definiciones técnicas, causas y consecuencias presentes en la imagen.
2. Principio de Atomicidad: Cada tarjeta debe cubrir UN solo concepto para facilitar el repaso espaciado.
3. Formato de Pregunta: Usa preguntas abiertas que desafíen la comprensión (Ej: "¿De qué manera el factor X influye en el proceso Y?").
4. Respuestas Técnicas: Máximo 2 oraciones, usando terminología precisa.
5. Calidad: Si el texto no da para ${count} tarjetas profundas, genera solo las que puedas con MÁXIMA CALIDAD académica.

Formato de Salida (ESTRICTO):
Responde ÚNICAMENTE con el objeto JSON. Sin introducciones, sin explicaciones, sin bloques de código markdown.
{
  "deck_metadata": { "suggested_title": "Título corto" },
  "flashcards": [
    { "question": "...", "answer": "..." }
  ]
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: formattedBase64
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(500).json({ error: 'Error al llamar a Groq API Vision', details: errorData });
    }

    const groqData = await response.json();
    const groqResponse = groqData.choices[0].message.content.trim();

    let jsonString = groqResponse;
    const jsonMatch = groqResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }
    jsonString = jsonString.trim();

    let cardsData;
    try {
      cardsData = JSON.parse(jsonString);
    } catch (parseError) {
      return res.status(500).json({ 
        error: 'Respuesta de Groq no es JSON válido', 
        details: groqResponse,
        parseError: parseError.message 
      });
    }

    if (!cardsData.flashcards || !Array.isArray(cardsData.flashcards)) {
      return res.status(500).json({ error: 'Estructura de respuesta de Groq inválida' });
    }

    db.run(
      `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
      [subject_id, user_id, title, 'Mazo generado con OCR + IA'],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });

        const deckId = this.lastID;

        const insertPromises = cardsData.flashcards.map((card) => {
          return new Promise((resolve, reject) => {
            db.run(
              `INSERT INTO flashcards (deck_id, front, back, status) VALUES (?, ?, ?, 'new')`,
              [deckId, card.question || card.front, card.answer || card.back],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        });

        Promise.all(insertPromises)
          .then(() => {
            db.all(
              `SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC`,
              [deckId],
              (err, cards) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({
                  id: deckId,
                  subject_id,
                  user_id,
                  title,
                  description: 'Mazo generado con OCR + IA',
                  card_count: cards.length,
                  cards: cards
                });
              }
            );
          })
          .catch((err) => {
            db.run(`DELETE FROM flashcard_decks WHERE id = ?`, [deckId], () => {
              res.status(500).json({ error: 'Error al insertar tarjetas, mazo revertido', details: err.message });
            });
          });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Error al generar tarjetas con OCR', details: err.message });
  }
};
