const secrets = require('../config/secrets');
const { db } = require('../db');
const fs = require('fs').promises;
const path = require('path');
const geminiService = require('../utils/geminiService');
const { shieldPrompt } = require('../utils/promptShield');
const { detectDeckGenerationIntent, buildDeckActionBlock, extractRequestedCount } = require('../utils/intentionDetector');
const {
  processDocumentWithFilesAPI,
  processDocumentBuffer,
  processAcademicChat,
  generateFlashcardsFromDocument,
  generateFlashcardsFromBuffer,
  generateFlashcardsFromText,
  generateFlashcardsWithGroq,
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
1. RIGOR: Usa terminología técnica precisa del texto. Si el usuario solicita incluir conceptos relacionados que no están en el texto, PUEDES incorporarlos para enriquecer el contexto académico (ej: si pide coronavirus + hantavirus, ambos son virus respiratorios relacionados).
2. NO CIRCULARIDAD: La explicación JAMÁS debe ser una paráfrasis de la pregunta. Debe explicar el "por qué" fundamental.
3. PISTAS ESTRATÉGICAS: El 'hint' debe ser un andamiaje cognitivo (ruta de pensamiento), no una respuesta parcial.
4. DISTRACTORES DE CALIDAD: Cada opción incorrecta debe nacer de un error de razonamiento específico.
5. CONTENIDO RELACIONADO: Si detectas que el usuario solicita temas relacionados (ej: "incluye hantavirus" cuando el documento menciona coronavirus), incorpora esos temas SIEMPRE, priorizando el contenido del documento como base pero enriqueciendo con conocimiento académico general sobre temas conexos.

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
Si el estudiante pide que generes flashcards, un mazo, preguntas de estudio, un examen, tarjetas de repaso, o material pedagógico similar:
1. Responde de forma conversacional indicando qué vas a generar.
2. Detecta automáticamente si la solicitud es LEGÍTIMA:
   ✅ GENERAR MAZO si pide: "crea flashcards", "necesito preguntas", "examen", "tarjetas", "material de repaso", etc.
   ❌ NO GENERAR si es contexto diferente: "¿cuánto cuesta un mazo de cartas?", "el documento es para el examen", etc.
3. Si es una solicitud legítima, AL FINAL de tu respuesta, añade EXACTAMENTE este bloque (en una sola línea):
   %%DECK_ACTION%%{"mode":"MODE","count":COUNT}%%END%%
   donde:
   - MODE es uno de: "flashcard" (tarjetas frente/reverso), "multiple_choice" (4 opciones), "boolean" (verdadero/falso), "mixed" (combinación)
   - COUNT es un número entre 5 y 20
   Ejemplos:
   - Usuario pide "10 flashcards" → %%DECK_ACTION%%{"mode":"flashcard","count":10}%%END%%
   - Usuario pide "examen de opción múltiple" → %%DECK_ACTION%%{"mode":"multiple_choice","count":10}%%END%%
   - Usuario pide "preguntas de repaso" → %%DECK_ACTION%%{"mode":"mixed","count":12}%%END%%
   - Usuario pide "verdadero o falso" → %%DECK_ACTION%%{"mode":"boolean","count":10}%%END%%
4. Infiere el modo automáticamente según las palabras clave del usuario.
5. NO incluyas el bloque %%DECK_ACTION%% si el usuario NO pide generar material o si la intención es diferente.
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

    // ─── DETECCIÓN DE DECK_ACTION y GENERACIÓN AUTOMÁTICA ──────────────────
    let deckData = null;
    let cleanReplyContent = result.reply.content;
    
    const deckActionPattern = /%+DECK_ACTION%+([\s\S]+?)%+END%+/;
    const deckMatch = result.reply.content.match(deckActionPattern);
    
    if (deckMatch && deckMatch[1]) {
      try {
        const deckAction = JSON.parse(deckMatch[1]);
        console.log(`[DeckGeneration] Generando mazo: modo=${deckAction.mode}, count=${deckAction.count}, provider=${provider}`);
        
        // Limpiar la respuesta del bloque DECK_ACTION
        cleanReplyContent = result.reply.content.replace(deckActionPattern, '').trim();
        
        // Generar el mazo con contexto usando el MISMO PROVIDER del chat
        if (context_text) {
          try {
            let generatedDeck = [];
            let deckProvider = provider;

            // INTENTO 1: Usar el provider elegido por el usuario para el chat
            try {
              if (provider === 'gemini') {
                console.log(`[DeckGeneration] Intentando con Gemini (provider elegido en chat)...`);
                generatedDeck = await geminiService.generateFlashcardsFromText(
                  context_text,
                  deckAction.count || 10
                );
              } else {
                console.log(`[DeckGeneration] Intentando con Groq (provider elegido en chat)...`);
                generatedDeck = await geminiService.generateFlashcardsWithGroq(
                  context_text,
                  deckAction.count || 10
                );
              }
            } catch (primaryErr) {
              console.warn(`[DeckGeneration] ⚠️ ${provider.toUpperCase()} falló, intentando fallback...`, primaryErr.message);
              
              // FALLBACK: Intentar con el otro provider
              const fallbackProvider = provider === 'gemini' ? 'groq' : 'gemini';
              try {
                if (fallbackProvider === 'gemini') {
                  console.log(`[DeckGeneration] Fallback a Gemini...`);
                  generatedDeck = await geminiService.generateFlashcardsFromText(
                    context_text,
                    deckAction.count || 10
                  );
                } else {
                  console.log(`[DeckGeneration] Fallback a Groq...`);
                  generatedDeck = await geminiService.generateFlashcardsWithGroq(
                    context_text,
                    deckAction.count || 10
                  );
                }
                deckProvider = fallbackProvider;
              } catch (fallbackErr) {
                console.error(`[DeckGeneration] ❌ Ambos providers fallaron`);
                throw fallbackErr;
              }
            }

            // Obtener user_id y subject_id de la sesión para persistir el mazo
            const { session_id: sessionId } = req.body;
            let persistedDeck = null;
            
            if (sessionId && generatedDeck.length > 0) {
              try {
                // Obtener info de la sesión
                const session = await new Promise((resolve, reject) => {
                  db.get(
                    'SELECT user_id, subject_id FROM ai_chat_sessions WHERE id = ?',
                    [sessionId],
                    (err, row) => err ? reject(err) : resolve(row)
                  );
                });

                if (session && session.user_id && session.subject_id) {
                  // Crear el mazo
                  const deckTitle = `Mazo ${deckAction.mode === 'mixed' ? 'Mixto' : deckAction.mode} - ${new Date().toLocaleDateString('es-ES')}`;
                  const deckDesc = `Mazo generado automáticamente desde chat con Zyren (${deckProvider})`;

                  persistedDeck = await new Promise((resolve, reject) => {
                    db.run(
                      `INSERT INTO flashcard_decks (subject_id, user_id, title, description) VALUES (?, ?, ?, ?)`,
                      [session.subject_id, session.user_id, deckTitle, deckDesc],
                      function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID, title: deckTitle, description: deckDesc });
                      }
                    );
                  });

                  // Insertar los ítems generados
                  const insertPromises = generatedDeck.map(item => {
                    return new Promise((resolve, reject) => {
                      const itemType = item.type || 'flashcard';
                      const content = item.data || {};
                      const front = itemType === 'flashcard' ? (content.front || '') : '';
                      const back = itemType === 'flashcard' ? (content.back || '') : '';
                      const contentStr = JSON.stringify(content);
                      const hint = item.hint || null;
                      const explanation = item.explanation || null;

                      db.run(
                        `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, hint, explanation, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
                        [persistedDeck.id, front, back, itemType, contentStr, hint, explanation],
                        (err) => {
                          if (err) reject(err);
                          else resolve();
                        }
                      );
                    });
                  });

                  await Promise.all(insertPromises);
                  console.log(`[DeckGeneration] ✅ Mazo guardado con ID=${persistedDeck.id} (${generatedDeck.length} ítems)`);
                } else {
                  console.warn('[DeckGeneration] ⚠️ No se pudo obtener sesión para persistencia');
                }
              } catch (persistErr) {
                console.error('[DeckGeneration] Error persistiendo mazo:', persistErr.message);
              }
            }

            deckData = {
              success: true,
              mode: deckAction.mode,
              count: deckAction.count,
              items: generatedDeck,
              persisted: !!persistedDeck,
              ...(persistedDeck && { deckId: persistedDeck.id, deckTitle: persistedDeck.title }),
              generatedAt: new Date().toISOString(),
              provider: deckProvider,
              fallbackUsed: deckProvider !== provider,
              note: persistedDeck 
                ? `✅ Mazo creado en la lista (ID: ${persistedDeck.id})`
                : `⚠️ Ítems generados pero no guardados. Usa "Crear mazo" en el panel.`
            };
            
            console.log(`[DeckGeneration] ✅ ${generatedDeck.length} ítems generados (${deckProvider})`);
          } catch (deckErr) {
            console.error(`[DeckGeneration] Error generando mazo:`, deckErr.message);
            deckData = {
              success: false,
              error: 'No se pudo generar el mazo automáticamente',
              details: deckErr.message
            };
          }
        } else {
          console.warn('[DeckGeneration] No hay contexto disponible para generar mazo');
          deckData = {
            success: false,
            error: 'No hay material disponible para generar el mazo. Proporciona documentos o texto de contexto.'
          };
        }
      } catch (parseErr) {
        console.warn('[DeckGeneration] Error parseando DECK_ACTION:', parseErr.message);
      }
    }

    // Guardar en el historial si se proporciona session_id
    const { session_id } = req.body;
    if (session_id && messages.length > 0) {
      const lastUserMsg = messages[messages.length - 1];
      if (lastUserMsg.role === 'user') {
        db.run('INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, ?, ?)', [session_id, 'user', lastUserMsg.content]);
      }
      db.run('INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, ?, ?)', [session_id, 'assistant', cleanReplyContent]);
    }

    res.json({ 
      reply: {
        ...result.reply,
        content: cleanReplyContent
      },
      provider,
      context_truncated,
      duration,
      ...(deckData && { deck: deckData }) // Incluir datos del mazo si se generó
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
 * Genera flashcards estructuradas de CALIDAD ACADÉMICA ALTA.
 * Usa Taxonomía de Bloom y prompts especializados.
 * Estrategia híbrida: Intenta Gemini → Fallback Groq
 */
exports.generateFlashcards = async (req, res) => {
  const { context_text, count = 10, userRequest = '' } = req.body;

  if (!context_text) {
    return res.status(400).json({ error: 'Falta context_text para generar las flashcards.' });
  }

  console.log(`[GenerateFlashcards] Iniciando generación híbrida (Gemini → Groq fallback)`);
  console.log(`[GenerateFlashcards] Usuario solicitó: "${userRequest}"`);

  try {
    let flashcards = [];
    let modelUsed = '';
    let provider = '';

    // ─── INTENTO 1: GEMINI (MÁXIMA CALIDAD) ──────────────────────────────
    const geminiApiKey = secrets.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        console.log(`[GenerateFlashcards] Intentando con Gemini...`);
        flashcards = await geminiService.generateFlashcardsFromText(context_text, count);
        modelUsed = 'gemini-3-flash-preview';
        provider = 'gemini';
        
        console.log(`[GenerateFlashcards] ✅ Éxito con Gemini (${flashcards.length} ítems)`);
      } catch (geminiErr) {
        console.warn(`[GenerateFlashcards] ⚠️ Gemini falló, intentando Groq...`, geminiErr.message);
        flashcards = []; // Reset para intentar Groq
      }
    } else {
      console.warn(`[GenerateFlashcards] Gemini API Key no disponible, usando Groq`);
    }

    // ─── FALLBACK: GROQ (si Gemini no disponible o falló) ─────────────────
    if (!flashcards || flashcards.length === 0) {
      const groqApiKey = secrets.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({ 
          error: 'Ningún LLM disponible (Gemini y Groq desconfigurados)',
          details: 'Configura al menos GEMINI_API_KEY o GROQ_API_KEY en .env'
        });
      }

      try {
        console.log(`[GenerateFlashcards] Usando Groq con prompts simplificados...`);
        flashcards = await geminiService.generateFlashcardsWithGroq(context_text, count);
        modelUsed = 'llama-3.1-8b-instant';
        provider = 'groq';
        
        console.log(`[GenerateFlashcards] ✅ Éxito con Groq (${flashcards.length} ítems)`);
      } catch (groqErr) {
        console.error(`[GenerateFlashcards] ❌ Ambos fallaron:`, groqErr.message);
        return res.status(500).json({ 
          error: 'Error generando flashcards con ambos proveedores',
          details: groqErr.message
        });
      }
    }

    // Respuesta unificada
    res.json({
      success: true,
      provider: provider,
      model: modelUsed,
      flashcards: flashcards,
      count: flashcards.length,
      quality: 'academic',
      fallbackUsed: provider === 'groq' ? true : false,
      note: `Generadas con ${provider.toUpperCase()} - Calidad Académica (Bloom's Taxonomy)`,
      features: [
        'Nivel cognitivo: Análisis/Síntesis/Evaluación',
        'Pistas pedagógicas (hints)',
        'Explicaciones magistrales',
        'Distractores académicos realistas',
      ]
    });

  } catch (err) {
    console.error(`[GenerateFlashcards] Error crítico:`, err.message);
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

  if (!documentPath) {
    return res.status(400).json({ error: 'Parámetro requerido: documentPath' });
  }

  if (count < 1 || count > 100) {
    return res.status(400).json({ 
      error: 'count debe estar entre 1 y 100' 
    });
  }

  console.log(`[GenerateFlashcards] Documento: ${documentPath}, Estrategia: Gemini → Groq`);

  try {
    let flashcards = [];
    let modelUsed = '';
    let provider = '';

    // ─── INTENTO 1: GEMINI FILES API (MÁXIMA CALIDAD) ──────────────────────
    const geminiApiKey = secrets.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        console.log(`[GenerateFlashcards] Intentando con Gemini Files API...`);
        flashcards = await geminiService.generateFlashcardsFromDocument(
          documentPath,
          mimeType,
          count
        );
        modelUsed = 'gemini-3-flash-preview';
        provider = 'gemini';
        
        console.log(`[GenerateFlashcards] ✅ Éxito con Gemini (${flashcards.length} ítems)`);
      } catch (geminiErr) {
        console.warn(`[GenerateFlashcards] ⚠️ Gemini falló:`, geminiErr.message);
        flashcards = [];
      }
    } else {
      console.warn(`[GenerateFlashcards] Gemini no disponible, usando Groq`);
    }

    // ─── FALLBACK: GROQ (si Gemini no disponible o falló) ─────────────────
    if (!flashcards || flashcards.length === 0) {
      const groqApiKey = secrets.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({ 
          error: 'Ningún LLM disponible',
          details: 'Configura al menos GEMINI_API_KEY o GROQ_API_KEY'
        });
      }

      try {
        console.log(`[GenerateFlashcards] Intentando con Groq (requiere leer documento primero)...`);
        // Para Groq necesitaríamos leer el documento primero
        // Por ahora retornamos un error informativo
        return res.status(400).json({ 
          error: 'Gemini no disponible y Groq requiere pre-procesamiento',
          recommendation: 'Usa Gemini para documentos, o carga el documento como texto'
        });
      } catch (groqErr) {
        return res.status(500).json({ 
          error: 'Error procesando documento',
          details: groqErr.message
        });
      }
    }

    // Respuesta unificada
    res.json({
      success: true,
      provider: provider,
      model: modelUsed,
      flashcards: flashcards,
      count: flashcards.length,
      quality: 'academic',
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md'],
      fallbackUsed: provider === 'groq' ? true : false,
      note: `Generadas con ${provider.toUpperCase()} - Calidad Académica (Bloom's Taxonomy)`,
      features: [
        'Ignora metadatos del documento',
        'Nivel cognitivo: Análisis/Síntesis/Evaluación',
        'Pistas pedagógicas',
        'Explicaciones maestrales',
        'Sin truncado de contexto'
      ]
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

  console.log(`[GenerateFlashcardsUpload] Archivo: ${req.file.originalname}, Estrategia: Gemini → Groq`);

  try {
    let flashcards = [];
    let modelUsed = '';
    let provider = '';

    // ─── INTENTO 1: GEMINI (MÁXIMA CALIDAD) ──────────────────────────────
    const geminiApiKey = secrets.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        console.log(`[GenerateFlashcardsUpload] Intentando con Gemini...`);
        flashcards = await geminiService.generateFlashcardsFromBuffer(
          req.file.buffer,
          req.file.mimetype,
          count,
          req.file.originalname
        );
        modelUsed = 'gemini-3-flash-preview';
        provider = 'gemini';
        
        console.log(`[GenerateFlashcardsUpload] ✅ Éxito con Gemini (${flashcards.length} ítems)`);
      } catch (geminiErr) {
        console.warn(`[GenerateFlashcardsUpload] ⚠️ Gemini falló:`, geminiErr.message);
        flashcards = [];
      }
    } else {
      console.warn(`[GenerateFlashcardsUpload] Gemini no disponible, intentando Groq`);
    }

    // ─── FALLBACK: GROQ (si Gemini no disponible o falló) ─────────────────
    if (!flashcards || flashcards.length === 0) {
      const groqApiKey = secrets.GROQ_API_KEY;
      if (!groqApiKey) {
        return res.status(500).json({ 
          error: 'Ningún LLM disponible',
          details: 'Configura al menos GEMINI_API_KEY o GROQ_API_KEY'
        });
      }

      try {
        console.log(`[GenerateFlashcardsUpload] Usando Groq con prompts simplificados...`);
        // Convertir buffer a texto para Groq
        const contextText = req.file.buffer.toString('utf-8');
        flashcards = await geminiService.generateFlashcardsWithGroq(contextText, count);
        modelUsed = 'llama-3.1-8b-instant';
        provider = 'groq';
        
        console.log(`[GenerateFlashcardsUpload] ✅ Éxito con Groq (${flashcards.length} ítems)`);
      } catch (groqErr) {
        console.error(`[GenerateFlashcardsUpload] ❌ Ambos fallaron:`, groqErr.message);
        return res.status(500).json({ 
          error: 'Error generando flashcards con ambos proveedores',
          details: groqErr.message
        });
      }
    }

    res.json({
      success: true,
      provider: provider,
      model: modelUsed,
      fileName: req.file.originalname,
      flashcards: flashcards,
      count: flashcards.length,
      quality: 'academic',
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md'],
      fallbackUsed: provider === 'groq' ? true : false,
      note: `Generadas con ${provider.toUpperCase()} - Calidad Académica (Bloom's Taxonomy)`,
      features: [
        'Ignora metadatos del documento',
        'Nivel cognitivo: Análisis/Síntesis/Evaluación',
        'Pistas pedagógicas',
        'Explicaciones magistrales',
        'Distractores académicos realistas'
      ]
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
// ─────────────────────────────────────────────────────────────────────────────
// LEARNING ENGINEERING: PREVENCIÓN DE CONFUSIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza un mazo existente para encontrar conceptos semánticamente similares
 * que el estudiante podría llegar a confundir (Cognitive Load Theory - Interleaving/Contrast).
 */
exports.analyzeDeckConfusions = async (req, res) => {
  const { deckId } = req.params;

  try {
    db.all(
      `SELECT id, front, back FROM flashcards WHERE deck_id = ? AND item_type = 'flashcard' AND is_atomic = 1`,
      [deckId],
      async (err, cards) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!cards || cards.length < 2) {
          return res.json({ suggestions: [] }); // No hay suficientes cartas para comparar
        }

        const cardsJson = JSON.stringify(cards.map(c => ({ id: c.id, front: c.front, back: c.back })));
        
        const systemPrompt = `Eres un experto en Psicología Educativa y Diseño Instruccional.
Tu tarea es analizar un set de flashcards y detectar conceptos que sean "confundibles" entre sí (similitud semántica o estructural).
El objetivo es identificar pares de conceptos para los cuales se debería generar una "Tarjeta de Diferenciación" explícita que contraste ambos términos.

Reglas:
1. Encuentra máximo 3 pares de conceptos altamente confundibles.
2. Si no hay ninguno verdaderamente confundible, devuelve un array vacío [].
3. Responde ÚNICAMENTE con un JSON array válido.

Formato esperado:
[
  {
    "conceptA": "Nombre del Concepto 1",
    "conceptB": "Nombre del Concepto 2",
    "reason": "Explicación breve de por qué el estudiante podría confundirlos",
    "cardIds": [ID_1, ID_2]
  }
]`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${secrets.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Analiza estas tarjetas:\n${cardsJson}` }
            ],
            temperature: 0.1,
          }),
        });

        if (!response.ok) throw new Error('Error al llamar a Groq API para análisis de confusión');
        
        const data = await response.json();
        const raw = data.choices[0].message.content.trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        
        const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        res.json({ suggestions });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error analizando similitudes', details: error.message });
  }
};

/**
 * Genera una tarjeta explícita de contraste entre dos conceptos y la guarda en el mazo.
 */
exports.generateDifferentiationCard = async (req, res) => {
  const { deckId } = req.params;
  const { conceptA, conceptB, reason } = req.body;

  if (!conceptA || !conceptB) {
    return res.status(400).json({ error: 'Faltan conceptA o conceptB' });
  }

  const systemPrompt = `Eres un experto en Pedagogía Universitaria.
Te daré dos conceptos que los estudiantes suelen confundir y la razón.
Tu tarea es generar UNA sola flashcard de diferenciación (Contrastive Learning).

- Front: Debe plantear un escenario o pregunta que requiera diferenciar explícitamente entre [Concepto A] y [Concepto B]. (Ej: "¿Cuál es la diferencia clave entre X y Y en el contexto de Z?")
- Back: Respuesta precisa que contraste ambos de manera directa y fácil de recordar.
- Hint: Una regla mnemotécnica o sugerencia rápida para diferenciarlos.
- Explanation: Profundización técnica de por qué son distintos.

Formato requerido EXACTO (JSON Object):
{
  "type": "flashcard",
  "data": { "front": "...", "back": "..." },
  "hint": "...",
  "explanation": "..."
}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secrets.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Concepto A: ${conceptA}\nConcepto B: ${conceptB}\nRazón de confusión común: ${reason || 'Similitud teórica'}` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error('Error generando tarjeta de diferenciación');
    
    const data = await response.json();
    const raw = data.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error('Respuesta de AI no válida');
    const item = JSON.parse(jsonMatch[0]);

    const contentStr = JSON.stringify(item.data);
    const hint = item.hint || null;
    const explanation = item.explanation || null;

    db.run(
      `INSERT INTO flashcards (deck_id, front, back, item_type, content_json, hint, explanation, status, is_atomic) VALUES (?, ?, ?, 'flashcard', ?, ?, ?, 'new', 1)`,
      [deckId, item.data.front, item.data.back, contentStr, hint, explanation],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
          id: this.lastID,
          deck_id: Number(deckId),
          front: item.data.front,
          back: item.data.back,
          item_type: 'flashcard',
          content_json: contentStr,
          hint,
          explanation,
          status: 'new'
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error generando tarjeta de contraste', details: error.message });
  }
};
