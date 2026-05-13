const secrets = require('../config/secrets');
const { db } = require('../db');
const fs = require('fs').promises;
const path = require('path');
const geminiService = require('../utils/geminiService');
const { shieldPrompt } = require('../utils/promptShield');
const {
  processDocumentWithFilesAPI,
  processDocumentBuffer,
  processAcademicChat,
  generateFlashcardsFromDocument,
  generateFlashcardsFromBuffer,
  getModelInfo,
} = geminiService;

/**
 * Helper para obtener el proveedor LLM seleccionado
 * @returns {string} 'groq' o 'gemini'
 */
function getLLMProvider(req) {
  const provider = req.query?.provider || req.body?.provider || 'groq';
  return (provider === 'gemini' || provider === 'groq') ? provider : 'groq';
}

/**
 * Helper para hacer llamadas a Groq API
 */
async function callGroqAPI(messages, systemPrompt) {
  const groqApiKey = secrets.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('Groq API Key no está configurada');
  }

  const apiMessages = [{ role: 'system', content: systemPrompt }, ...messages];
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: apiMessages,
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Groq API Error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return {
    provider: 'groq',
    reply: data.choices[0].message,
    duration: 0,
  };
}

/**
 * Genera un mazo de material de estudio (flashcard|multiple_choice|boolean|mixed)
 * directamente desde el contexto del chat de Zyren.
 *
 * Zyren conoce la estructura exacta de los ítems y genera JSON válido para
 * insertar directamente en la tabla `flashcards` (polimórfica).
 */
exports.generateStudyMaterial = async (req, res) => {
  const { context_text, mode = 'mixed', count = 10, title, subject_id, user_id } = req.body;

  if (!context_text || !title || !subject_id || !user_id) {
    return res.status(400).json({ error: 'Faltan campos: context_text, title, subject_id, user_id' });
  }

  const groqApiKey = secrets.GROQ_API_KEY;
  if (!groqApiKey) return res.status(500).json({ error: 'Groq API Key no está configurada' });

  // ── Sistema prompt que le enseña a Zyren la estructura exacta ──────────────
  const modeInstructions = {
    flashcard: `Genera exactamente ${count} FLASHCARDS.
- Front: Pregunta conceptual desafiante.
- Back: Respuesta precisa y técnica (máximo 2-3 oraciones).
- Hint: Pista que active el recuerdo (ej. "Considera el factor Z"), no letras iniciales.
- Explanation: Profundiza en el concepto con el "por qué" fundamental o un ejemplo.
Esquema: { "type": "flashcard", "data": { "front": "...", "back": "..." }, "hint": "...", "explanation": "..." }`,

    multiple_choice: `Genera exactamente ${count} PREGUNTAS DE SELECCIÓN MÚLTIPLE (estilo ECAES/SABER PRO).
- Opciones: Exactamente 4 opciones con contenido semántico ÚNICO y diferenciado. PROHIBIDO que dos opciones representen el mismo concepto incluso con palabras distintas.
- Distractores: Deben nacer de un error de razonamiento específico (fórmula mal aplicada, confusión de términos similares, etc.). No rellenes con opciones aleatorias.
- Explanation: Explica la validez de la correcta y la falla lógica de los distractores.
Esquema: { "type": "multiple_choice", "data": { "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": N }, "hint": "...", "explanation": "..." }`,

    boolean: `Genera exactamente ${count} PREGUNTAS DE VERDADERO O FALSO.
- Question: Afirmación con matices técnicos que desafíe la comprensión obvia.
- Explanation: Justifica la veracidad/falsedad con un argumento sólido basado en la teoría.
Esquema: { "type": "boolean", "data": { "question": "...", "correctAnswer": true/false }, "hint": "...", "explanation": "..." }`,

    mixed: `Genera exactamente ${count} ÍTEMS MIXTOS (40% Flashcard, 40% Selección Múltiple, 20% V/F).
Debes usar estrictamente estos 3 esquemas según el ítem:
1. Flashcard: { "type": "flashcard", "data": { "front": "...", "back": "..." }, "hint": "...", "explanation": "..." }
2. Selección Múltiple: { "type": "multiple_choice", "data": { "question": "...", "options": ["A","B","C","D"], "correctIndex": N }, "hint": "...", "explanation": "..." }
3. Verdadero/Falso: { "type": "boolean", "data": { "question": "...", "correctAnswer": true/false }, "hint": "...", "explanation": "..." }`,
  };

  const systemPrompt = `Eres Zyren, experto en pedagogía universitaria y diseño instruccional. Tu misión es transformar contenido en material de ALTO RENDIMIENTO.

REGLAS DE ORO:
1. RIGOR: Usa terminología técnica precisa del texto.
2. NO CIRCULARIDAD: La explicación JAMÁS debe ser una paráfrasis de la pregunta. Debe explicar el "por qué" fundamental.
3. PISTAS ESTRATÉGICAS: El 'hint' debe ser un andamiaje cognitivo (ruta de pensamiento), no una respuesta parcial.
4. DISTRACTORES DE CALIDAD: Cada opción incorrecta debe nacer de un error de razonamiento específico.

${modeInstructions[mode] || modeInstructions.mixed}

Responde ÚNICAMENTE con el array JSON, sin texto introductorio ni conclusiones.`;

  try {
    const trimmedContext = context_text.length > 8000
      ? context_text.substring(0, 8000) + '\n[...contexto truncado]'
      : context_text;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera el material de estudio basado en este contenido académico:\n\n${trimmedContext}` },
        ],
        temperature: 0.2,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: 'Error llamando a Groq', details: err });
    }

    const groqData = await response.json();
    const raw = groqData.choices[0].message.content.trim();

    // Extraer JSON array
    let jsonStr = raw;
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];

    let items;
    try { items = JSON.parse(jsonStr); }
    catch (_) { return res.status(500).json({ error: 'Zyren no retornó JSON válido', raw: raw.substring(0, 500) }); }

    if (!Array.isArray(items)) {
      return res.status(500).json({ error: 'Zyren retornó un objeto, no un array' });
    }

    const description = `Material ${mode === 'mixed' ? 'mixto' : mode} generado por Zyren`;

    // Crear el mazo en la BD
    db.run(
      `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
      [subject_id, user_id, title, description],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const deckId = this.lastID;

        // Insertar todos los ítems
        const inserts = items.map(item => new Promise((resolve, reject) => {
          const itemType = item.type || 'flashcard';
          const content = item.data || {};
          const front = itemType === 'flashcard' ? (content.front || '') : '';
          const back = itemType === 'flashcard' ? (content.back || '') : '';
          const contentStr = JSON.stringify(content);
          const hint = item.hint || null;
          const explanation = item.explanation || null;

          db.run(
            `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, hint, explanation, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
            [deckId, front, back, itemType, contentStr, hint, explanation],
            function(e) { if (e) reject(e); else resolve(); }
          );
        }));

        Promise.all(inserts)
          .then(() => {
            db.all(`SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at ASC`, [deckId], (e, cards) => {
              if (e) return res.status(500).json({ error: e.message });
              res.status(201).json({
                id: deckId, title, description, subject_id, user_id,
                card_count: cards.length,
                mode,
                cards: cards.map(c => {
                  let content = null;
                  try { content = JSON.parse(c.content_json || '{}'); } catch (_) {}
                  return { ...c, content };
                }),
              });
            });
          })
          .catch(e => {
            db.run(`DELETE FROM flashcard_decks WHERE id = ?`, [deckId], () => {});
            res.status(500).json({ error: 'Error insertando ítems', details: e.message });
          });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Error generando material de estudio con Zyren', details: err.message });
  }
};


/**
 * Helper para hacer llamadas a Google Gemini API (mejorado con Files API)
 * Ahora usa el SDK oficial de Google para mejor manejo de contextos grandes
 */
async function callGeminiAPI(messages, systemPrompt) {
  const geminiApiKey = secrets.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('Gemini API Key no está configurada');
  }

  try {
    console.log('[callGeminiAPI] 🤖 Iniciando...');
    console.log('[callGeminiAPI] Mensajes:', messages.length);
    console.log('[callGeminiAPI] System prompt length:', systemPrompt?.length || 0);

    // Usar el nuevo servicio de Gemini con mejor manejo
    const result = await processAcademicChat(
      '',  // contextText ya está en systemPrompt
      messages,
      systemPrompt
    );
    
    console.log('[callGeminiAPI] ✅ Respuesta exitosa');

    return {
      provider: 'gemini',
      reply: { role: 'assistant', content: result.content },
      duration: 0,
    };
  } catch (error) {
    console.error('[callGeminiAPI] ❌ Error detallado:', {
      message: error.message,
      code: error.code,
      status: error.status,
      fullError: error
    });
    throw new Error(`[Gemini] ${error.message}`);
  }
}

/**
 * Chat con Zyren usando contexto de la materia
 * Soporta tanto Groq (velocidad) como Gemini (mayor capacidad)
 */
exports.aiChat = async (req, res) => {
  console.log('--- [DEBUG] Petición recibida en aiChat ---');
  const { context_text, messages } = req.body;
  const provider = getLLMProvider(req);

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Falta el array de mensajes.' });
  }

  // Limitar el contexto según el proveedor - MÁS AGRESIVO
  const MAX_CONTEXT_CHARS = provider === 'gemini' ? 15000 : 5000; // Reducido para evitar límites
  const contextLength = context_text ? context_text.length : 0;
  const trimmedContext = contextLength > MAX_CONTEXT_CHARS
    ? context_text.substring(0, MAX_CONTEXT_CHARS) + '\n\n[...Contexto truncado por límite de tokens...]'
    : context_text;
  
  console.log(`[${provider.toUpperCase()}] Context truncado: ${contextLength} -> ${trimmedContext.length} chars`);

  console.log(`[${provider.toUpperCase()}Telemetry] Context size: ${contextLength} chars -> Trimmed to: ${trimmedContext.length}`);

  // Generar prompt dinámico según si hay contexto o no
  let systemMessage;

  // Instrucciones comunes para generación de mazos (en ambos modos)
  const deckGenerationInstructions = `

---
INSTRUCCIONES ESPECIALES PARA GENERAR MAZOS DE ESTUDIO:
Si el estudiante pide que generes flashcards, un mazo, preguntas de estudio, un examen, o material de repaso:
1. Responde de forma conversacional indicando qué vas a generar.
2. AL FINAL de tu respuesta, añade EXACTAMENTE este bloque (sin espacios extra, en una sola línea):
   %%DECK_ACTION%%{"mode":"MODE","count":COUNT}%%END%%
   donde:
   - MODE es uno de: "flashcard" (tarjetas frente/reverso), "multiple_choice" (4 opciones estilo ECAES), "boolean" (verdadero/falso), "mixed" (combinación pedagógica)
   - COUNT es un número entre 5 y 20 (infiere la cantidad del contexto o usa 10 si no se especifica)
   Ejemplos:
   - "genera 10 flashcards" → %%DECK_ACTION%%{"mode":"flashcard","count":10}%%END%%
   - "crea un examen" → %%DECK_ACTION%%{"mode":"multiple_choice","count":10}%%END%%
   - "material de repaso mixto" → %%DECK_ACTION%%{"mode":"mixed","count":12}%%END%%
   - "preguntas de verdadero/falso" → %%DECK_ACTION%%{"mode":"boolean","count":10}%%END%%
3. NO incluyas el bloque %%DECK_ACTION%% si el usuario NO pide generar material.
---`;

  if (trimmedContext) {
    // MODO CON CONTEXTO: Estricto con los archivos/materiales proporcionados
    systemMessage = `Eres "Zyren", un tutor académico personal experto y paciente.

INSTRUCCIONES:
- El estudiante te ha proporcionado archivos o materiales específicos sobre un tema.
- Tu objetivo es responder basándote ESTRICTAMENTE en estos materiales.
- Fundamenta todas tus respuestas en el contenido de los archivos/documentos proporcionados.
- Si la pregunta no puede responderse con la información en los archivos, indica claramente que esa información no está disponible en los materiales proporcionados.
- Sé didáctico, claro y estructurado (usa viñetas si es necesario).
- Mantén un tono alentador y profesional.
${deckGenerationInstructions}

--- CONTEXTO DE LA MATERIA ---
${trimmedContext}
------------------------------`;
  } else {
    systemMessage = `Eres "Zyren", un tutor académico personal experto y paciente.

INSTRUCCIONES:
- El estudiante no ha proporcionado archivos o materiales específicos.
- Puedes responder abiertamente usando tu conocimiento académico general.
- Explica los conceptos de forma clara, didáctica y estructurada (usa viñetas si es necesario).
- Adapta el nivel de complejidad según la pregunta.
- Mantén un tono alentador, profesional y motivador.
- Ofrece ejemplos cuando sea apropiado para mejorar la comprensión.
${deckGenerationInstructions}`;
  }

  try {
    console.log(`🤖 [${provider.toUpperCase()}Telemetry] Llamando a ${provider.toUpperCase()} API...`);
    console.log('📋 [Telemetry] Total mensajes en contexto:', messages.length + 1);
    
    const startTime = Date.now();
    
    let result;
    if (provider === 'gemini') {
      result = await callGeminiAPI(messages, systemMessage);
    } else {
      result = await callGroqAPI(messages, systemMessage);
    }

    const duration = Date.now() - startTime;
    console.log(`📡 [${provider.toUpperCase()}Telemetry] Respuesta recibida en ${duration}ms.`);
    console.log(`✅ Respuesta exitosa de ${provider.toUpperCase()}`);
    
    const context_truncated = context_text && context_text.length > MAX_CONTEXT_CHARS;

    // Guardar en el historial si se proporciona session_id
    const { session_id } = req.body;
    if (session_id && messages.length > 0) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg.role === 'user') {
        db.run('INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, ?, ?)', [session_id, 'user', lastUserMsg.content]);
      }
      db.run('INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, ?, ?)', [session_id, 'assistant', result.reply.content]);
    }

    res.json({ 
      reply: result.reply,
      provider,
      context_truncated,
      duration,
    });
  } catch (err) {
    console.error(`💥 Error crítico en aiChat [${provider}]:`, err);
    res.status(500).json({ error: `Error en el chat de IA con ${provider}`, details: err.message, provider });
  }
};

/**
 * Obtiene el historial de chat para una materia y usuario
 */
exports.getChatHistory = async (req, res) => {
  const { userId, subjectId } = req.params;
  
  try {
    // Limpieza de seguridad: eliminar mensajes más antiguos de 24 horas
    // Esto evita saturar el contexto de la IA y limpiar la base de datos
    const dateLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sqlDateLimit = dateLimit.toISOString().replace('T', ' ').substring(0, 19);
    
    await new Promise((resolve) => {
      db.run('DELETE FROM ai_chat_messages WHERE created_at < ?', [sqlDateLimit], () => resolve());
    });

    const session = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM ai_chat_sessions WHERE user_id = ? AND subject_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId, subjectId],
        (err, row) => err ? reject(err) : resolve(row)
      );
    });

    if (!session) {
      db.run(
        'INSERT INTO ai_chat_sessions (user_id, subject_id, title) VALUES (?, ?, ?)',
        [userId, subjectId, 'Nueva Sesión'],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ session_id: this.lastID, messages: [] });
        }
      );
      return;
    }

    db.all(
      'SELECT role, content FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      [session.id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ session_id: session.id, messages: rows });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Limpia el historial actual creando una nueva sesión
 */
exports.clearChatHistory = async (req, res) => {
  const { userId, subjectId } = req.params;
  try {
    db.run(
      'INSERT INTO ai_chat_sessions (user_id, subject_id, title) VALUES (?, ?, ?)',
      [userId, subjectId, 'Nueva Sesión'],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ session_id: this.lastID, messages: [] });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Construye un contexto unificado a partir de una lista de archivos/recursos seleccionados.
 * Soporta fotos (OCR), audios, videos de YouTube y documentos.
 */
exports.buildContext = async (req, res) => {
  const { items } = req.body; // Array de { id, type, label }

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Se requiere un array de items para construir el contexto.' });
  }

  try {
    const contextPromises = items.map(async (item) => {
      let text = '';
      
      try {
        if (item.type === 'photo') {
          // Leer ocr_text de la tabla photos (donde PhotoCaptureModal y DocumentScannerModal guardan las fotos)
          console.log(`[buildContext] Processing photo: id=${item.id}, label="${item.label}"`);
          
          const photo = await new Promise((resolve, reject) => {
            db.get('SELECT ocr_text, local_uri FROM photos WHERE id = ?', [item.id], (err, row) => {
              if (err) {
                console.error(`[buildContext] DB error for photo_id=${item.id}:`, err.message);
                reject(err);
              } else {
                console.log(`[buildContext] Query result for photo_id=${item.id}:`, row);
                resolve(row);
              }
            });
          });
          
          if (photo?.ocr_text) {
            console.log(`[buildContext] Using ocr_text for photo_id=${item.id}`);
            text = `[FOTO: ${item.label}]\n${photo.ocr_text}`;
          } else {
            console.log(`[buildContext] No ocr_text for photo_id=${item.id}, label="${item.label}"`);
          }
        } 
        else if (item.type === 'recording') {
          // Obtener transcripción de audio
          console.log(`[buildContext] Processing recording: id=${item.id}, label="${item.label}"`);
          
          const transcript = await new Promise((resolve, reject) => {
            db.get(`
              SELECT transcript_text, transcript_uri 
              FROM audio_transcripts 
              WHERE recording_id = ?
            `, [item.id], (err, row) => {
              if (err) {
                console.error(`[buildContext] DB error for recording_id=${item.id}:`, err.message);
                reject(err);
              } else {
                console.log(`[buildContext] Query result for recording_id=${item.id}:`, row);
                resolve(row);
              }
            });
          });

          if (transcript?.transcript_text) {
            console.log(`[buildContext] Using transcript_text for recording_id=${item.id}`);
            text = `[AUDIO: ${item.label}]\n${transcript.transcript_text}`;
          } else if (transcript?.transcript_uri) {
            // Intentar leer desde archivo si no está inline
            console.log(`[buildContext] Attempting to read file: ${transcript.transcript_uri}`);
            try {
              const fileContent = await fs.readFile(transcript.transcript_uri, 'utf8');
              text = `[AUDIO: ${item.label}]\n${fileContent}`;
            } catch (fErr) {
              console.warn(`No se pudo leer archivo de audio: ${transcript.transcript_uri}`, fErr.message);
            }
          } else {
            console.log(`[buildContext] No hay transcripción para recording_id=${item.id}, label="${item.label}"`);
          }
        }
        else if (item.type === 'video') {
          // 1. Buscar transcript cacheado en la BD
          console.log(`[buildContext] Processing video: id=${item.id}, label="${item.label}"`);
          
          const ytTranscript = await new Promise((resolve, reject) => {
            db.get(`
              SELECT transcript_text, transcript_uri 
              FROM youtube_transcripts 
              WHERE video_id = ?
            `, [item.id], (err, row) => {
              if (err) {
                console.error(`[buildContext] DB error for video_id=${item.id}:`, err.message);
                reject(err);
              } else {
                console.log(`[buildContext] Query result for video_id=${item.id}:`, row);
                resolve(row);
              }
            });
          });

          if (ytTranscript?.transcript_text) {
            // Caso ideal: texto inline en la BD — costo cero
            console.log(`[buildContext] Using transcript_text for video_id=${item.id}`);
            text = `[VIDEO YOUTUBE: ${item.label}]\n${ytTranscript.transcript_text}`;
          } else if (ytTranscript?.transcript_uri) {
            // Fallback: leer desde archivo
            console.log(`[buildContext] Attempting to read file: ${ytTranscript.transcript_uri}`);
            try {
              const fileContent = await fs.readFile(ytTranscript.transcript_uri, 'utf8');
              text = `[VIDEO YOUTUBE: ${item.label}]\n${fileContent}`;
            } catch (fErr) {
              console.warn(`No se pudo leer archivo de video: ${ytTranscript.transcript_uri}`);
            }
          } else {
            // No hay transcript cacheado — obtener captions de YouTube en tiempo real
            // y guardarlas en la BD para las próximas consultas
            console.log(`[buildContext] No transcript cached for video_id=${item.id}, attempting to fetch from YouTube`);
            try {
              const ytVideo = await new Promise((resolve, reject) => {
                db.get('SELECT video_id FROM youtube_videos WHERE id = ?', [item.id], (err, row) => {
                  if (err) reject(err); else resolve(row);
                });
              });

              if (ytVideo?.video_id) {
                const captionRes = await fetch(
                  `http://localhost:${secrets.PORT || 3000}/api/youtube-captions`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_id: ytVideo.video_id }),
                  }
                );

                if (captionRes.ok) {
                  const captionData = await captionRes.json();
                  if (captionData.captions) {
                    text = `[VIDEO YOUTUBE: ${item.label}]\n${captionData.captions}`;
                    // Guardar en BD para no repetir el fetch la próxima vez
                    db.run(
                      `INSERT OR REPLACE INTO youtube_transcripts (video_id, transcript_text)
                       VALUES (?, ?)
                       ON CONFLICT(video_id) DO UPDATE SET transcript_text = excluded.transcript_text`,
                      [item.id, captionData.captions],
                      (saveErr) => { if (saveErr) console.warn('No se pudo cachear transcript de YouTube:', saveErr.message); }
                    );
                  }
                }
              }
            } catch (captionErr) {
              console.warn(`No se pudieron obtener captions para video ${item.id}:`, captionErr.message);
            }
          }
        }
        else if (item.type === 'document') {
          // Obtener OCR de documentos escaneados (columna nueva ocr_text)
          const doc = await new Promise((resolve, reject) => {
            db.get('SELECT ocr_text, name FROM scanned_documents WHERE id = ?', [item.id], (err, row) => {
              if (err) reject(err); else resolve(row);
            });
          });
          text = doc?.ocr_text ? `[DOCUMENTO: ${doc.name || item.label}]\n${doc.ocr_text}` : `[DOCUMENTO: ${doc?.name || item.label}] (Sin contenido de texto extraído aún)`;
        }
      } catch (itemErr) {
        console.error(`Error procesando item ${item.id} (${item.type}):`, itemErr);
      }

      return text;
    });

    const results = await Promise.all(contextPromises);
    const successfulItems = results.filter(t => t.length > 0);
    const finalContext = successfulItems.join('\n\n---\n\n');

    console.log(`[buildContext] Procesados ${results.length} items, ${successfulItems.length} con contenido exitoso`);
    
    res.json({ 
      context: finalContext,
      itemsCount: successfulItems.length
    });

  } catch (err) {
    res.status(500).json({ error: 'Error al construir el contexto', details: err.message });
  }
};

/**
 * Genera flashcards estructuradas (pares pregunta/respuesta) a partir de un
 * bloque de texto de contexto académico usando Groq o Gemini.
 *
 * El modelo retorna un array JSON de objetos con { front, back } o { question, answer }
 */
exports.generateFlashcards = async (req, res) => {
  const { context_text, count = 10 } = req.body;
  const provider = getLLMProvider(req);

  if (!context_text) {
    return res.status(400).json({ error: 'Falta context_text para generar las flashcards.' });
  }

  console.log(`[GenerateFlashcards] Usando proveedor: ${provider}`);

  try {
    let flashcards = [];
    let modelUsed = '';

    if (provider === 'gemini') {
      // ─── GEMINI PATH ───────────────────────────────────────────────
      const geminiApiKey = secrets.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'Gemini API Key no está configurada' });
      }

      console.log(`[GenerateFlashcards] Llamando a Gemini...`);
      flashcards = await geminiService.generateFlashcardsFromText(context_text, count);
      modelUsed = 'gemini-3-flash-preview';

    } else {
      // ─── GROQ PATH ────────────────────────────────────────────────
      const groqApiKey = secrets.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({ error: 'Groq API Key no está configurada' });
      }

      // Limitar el contexto por límites de Groq (6000 TPM)
      const trimmedContext = context_text.length > 12000
        ? context_text.substring(0, 12000) + '\n[...contexto truncado por longitud]'
        : context_text;

      const systemPrompt = `Tu nombre es Zyren. Eres un experto pedagogo universitario. Tu tarea es generar exactamente ${count} flashcards de estudio a partir del material académico proporcionado.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional, sin markdown, sin explicaciones.
2. Cada elemento del array debe tener exactamente dos campos: "front" (pregunta o concepto) y "back" (respuesta o definición).
3. Las preguntas deben ser precisas y directas. Las respuestas, concisas pero completas.
4. Cubre los conceptos más importantes del material. Evita preguntas triviales.
5. Formato exacto requerido: [{"front": "...", "back": "..."}, ...]

Ejemplo de respuesta válida:
[{"front": "¿Qué es la fotosíntesis?", "back": "Proceso por el cual las plantas convierten luz solar en glucosa usando CO₂ y agua."}]`;

      console.log(`[GenerateFlashcards] Llamando a Groq...`);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Genera ${count} flashcards a partir de este material:\n\n${trimmedContext}` },
          ],
          temperature: 0.4,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(500).json({ error: 'Error al llamar a Groq', details: errorData });
      }

      const groqData = await response.json();
      const rawContent = groqData.choices?.[0]?.message?.content || '{}';

      // Parsear el JSON retornado por el modelo
      try {
        const parsed = JSON.parse(rawContent);
        // El modelo puede retornar el array directamente o dentro de una clave
        flashcards = Array.isArray(parsed)
          ? parsed
          : (parsed.flashcards || parsed.cards || parsed.data || []);
      } catch (parseErr) {
        console.error('Error parseando JSON de flashcards:', rawContent.substring(0, 200));
        return res.status(500).json({ error: 'El modelo no retornó un JSON válido.', raw: rawContent.substring(0, 500) });
      }

      modelUsed = 'llama-3.1-8b-instant';
    }

    // Respuesta unificada
    res.json({
      success: true,
      provider: provider,
      model: modelUsed,
      flashcards: flashcards,
      count: flashcards.length,
      note: `Generadas con ${provider.toUpperCase()} - ${modelUsed}`
    });

  } catch (err) {
    console.error(`[GenerateFlashcards] Error:`, err.message);
    res.status(500).json({ error: 'Error generando flashcards', details: err.message });
  }
};

/**
 * Procesa un documento (PDF, Word, TXT) usando Gemini Files API
 * Sin truncado de contexto - procesa documentos completos sin límite práctico
 * 
 * Soportado: .pdf, .docx, .doc, .txt, .html, .md
 * Ideal para: Análisis de documentos, resúmenes, extracción de información
 */
exports.processDocumentWithGemini = async (req, res) => {
  const { documentPath, mimeType, prompt } = req.body;

  if (!documentPath || !prompt) {
    return res.status(400).json({ 
      error: 'Parámetros requeridos: documentPath, prompt' 
    });
  }

  const geminiApiKey = secrets.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API Key no está configurada' });
  }

  try {
    console.log(`[ProcessDocument] Archivo: ${documentPath}`);
    console.log(`[ProcessDocument] MIME Type: ${mimeType || 'auto-detect'}`);

    // 🛡️ Fase 3: Escudar el prompt contra Inyecciones (Jailbreaks)
    const securePrompt = shieldPrompt(prompt);

    // Usar el servicio geminiService (auto-detecta MIME type)
    const result = await geminiService.processDocumentWithFilesAPI(
      documentPath,
      mimeType, // null = auto-detect
      securePrompt
    );

    res.json({
      success: true,
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      result: result,
      features: [
        'Sin truncado de contexto',
        'Procesa documentos completos',
        'Soporta: PDF, Word, TXT, HTML, Markdown'
      ]
    });
  } catch (err) {
    console.error('[ProcessDocument] Error:', err.message);
    res.status(400).json({
      error: 'Error procesando documento',
      details: err.message,
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md']
    });
  }
};

/**
 * Genera flashcards de estudio desde un documento (PDF, Word, TXT)
 * Soporta Groq y Gemini (recomendado para documentos grandes)
 * 
 * Retorna: Array de objetos { question, answer } o { front, back }
 */
exports.generateFlashcardsFromDocument = async (req, res) => {
  const { documentPath, mimeType, count = 10 } = req.body;
  const provider = getLLMProvider(req);

  if (!documentPath) {
    return res.status(400).json({ error: 'Parámetro requerido: documentPath' });
  }

  if (count < 1 || count > 100) {
    return res.status(400).json({ 
      error: 'count debe estar entre 1 y 100' 
    });
  }

  console.log(`[GenerateFlashcards] Documento: ${documentPath}, Proveedor: ${provider}`);

  try {
    let flashcards = [];
    let modelUsed = '';

    if (provider === 'gemini') {
      // ─── GEMINI PATH ───────────────────────────────────────────────
      const geminiApiKey = secrets.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'Gemini API Key no está configurada' });
      }

      console.log(`[GenerateFlashcards] Llamando a Gemini Files API...`);
      flashcards = await geminiService.generateFlashcardsFromDocument(
        documentPath,
        mimeType, // null = auto-detect
        count
      );
      modelUsed = 'gemini-3-flash-preview';

    } else {
      // ─── GROQ PATH (requiere convertir documento a texto primero) ───
      const groqApiKey = secrets.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({ error: 'Groq API Key no está configurada' });
      }

      console.log(`[GenerateFlashcards] Groq requiere pre-procesamiento del documento`);
      return res.status(400).json({ 
        error: 'Para procesar documentos con Groq, primero convierte el documento a texto usando el endpoint de procesamiento.',
        recommendation: 'Usa Gemini para documentos (endpoint: /ai/process-document) o proporciona el texto directamente (endpoint: /ai/generate-flashcards)',
        supportedProviders: ['gemini'],
      });
    }

    // Respuesta unificada
    res.json({
      success: true,
      provider: provider,
      model: modelUsed,
      flashcards: flashcards,
      count: flashcards.length,
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md'],
      note: `Generadas con ${provider.toUpperCase()} - ${modelUsed}`
    });

  } catch (err) {
    console.error('[GenerateFlashcards] Error:', err.message);
    res.status(400).json({
      error: 'Error generando flashcards desde documento',
      details: err.message,
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md']
    });
  }
};

/**
 * Procesa un documento (PDF, Word, TXT) cargado directamente sin guardar en disco
 * Envía el archivo en memoria directamente a Gemini
 * 
 * Soporta: PDF, Word, TXT, HTML, Markdown
 * Tamaño máximo: 100 MB
 */
exports.processDocumentUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó archivo' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Parámetro requerido: prompt' });
  }

  const geminiApiKey = secrets.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API Key no está configurada' });
  }

  try {
    console.log(`[ProcessDocumentUpload] Archivo: ${req.file.originalname}, Tamaño: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
    console.log(`[ProcessDocumentUpload] MIME Type: ${req.file.mimetype}`);

    // 🛡️ Fase 3: Escudar el prompt contra Inyecciones
    const securePrompt = shieldPrompt(prompt);

    // Procesar el buffer del archivo directamente con Gemini
    const result = await geminiService.processDocumentBuffer(
      req.file.buffer,
      req.file.mimetype,
      securePrompt,
      req.file.originalname
    );

    res.json({
      success: true,
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      fileName: req.file.originalname,
      fileSize: `${(req.file.size / 1024 / 1024).toFixed(2)}MB`,
      result: result,
      features: [
        'Sin truncado de contexto',
        'Procesa documentos completos',
        'Soporta: PDF, Word, TXT, HTML, Markdown',
        'Sin guardar en disco'
      ]
    });
  } catch (err) {
    console.error('[ProcessDocumentUpload] Error:', err.message);
    res.status(400).json({
      error: 'Error procesando documento',
      details: err.message,
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md']
    });
  }
};

/**
 * Genera flashcards desde un archivo cargado directamente (sin guardar en disco)
 * Procesa en memoria con Gemini Files API
 * 
 * Soporta: PDF, Word, TXT, HTML, Markdown
 */
exports.generateFlashcardsUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó archivo' });
  }

  const { count = 10 } = req.body;

  if (count < 1 || count > 100) {
    return res.status(400).json({ 
      error: 'count debe estar entre 1 y 100' 
    });
  }

  const geminiApiKey = secrets.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API Key no está configurada' });
  }

  try {
    console.log(`[GenerateFlashcardsUpload] Archivo: ${req.file.originalname}, ${count} flashcards`);

    // Generar flashcards desde el buffer del archivo
    const flashcards = await geminiService.generateFlashcardsFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      count,
      req.file.originalname
    );

    res.json({
      success: true,
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      fileName: req.file.originalname,
      flashcards: flashcards,
      count: flashcards.length,
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md'],
      note: 'Flashcards generadas en tiempo real sin guardar archivo'
    });
  } catch (err) {
    console.error('[GenerateFlashcardsUpload] Error:', err.message);
    res.status(400).json({
      error: 'Error generando flashcards',
      details: err.message,
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md']
    });
  }
};

/**
 * Obtiene información sobre los modelos disponibles y sus límites
 */
exports.getModelInfo = async (req, res) => {
  try {
    const groqInfo = {
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      contextLimit: '12 KB',
      speed: 'Ultra rápido (~50ms)',
      costOptimization: 'Muy económico',
      bestFor: ['Chats rápidos', 'Contexto moderado', 'Real-time'],
    };

    const geminiInfo = {
      provider: 'gemini',
      model: 'gemini-3-flash-preview',
      contextLimit: '1,000,000 tokens (~50KB+)',
      speed: 'Rápido (~200-500ms)',
      costOptimization: 'Extremadamente eficiente para PDFs',
      bestFor: ['Documentos grandes', 'PDFs', 'Análisis profundo', 'Flashcards de calidad'],
      filesAPI: 'Soportado - Ideal para archivos >1MB',
    };

    res.json({
      providers: [groqInfo, geminiInfo],
      recommendation: 'Usa Groq para chat rápido, Gemini para documentos grandes',
      filesAPINote: 'Los archivos procesados con Files API se eliminan después de 48 horas',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
