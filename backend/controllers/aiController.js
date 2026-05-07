const { db } = require('../db');
const fs = require('fs').promises;
const path = require('path');
const { 
  processDocumentWithFilesAPI, 
  processAcademicChat, 
  generateFlashcardsFromDocument,
  getModelInfo 
} = require('../utils/geminiService');

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
  const groqApiKey = process.env.GROQ_API_KEY;
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
 * Helper para hacer llamadas a Google Gemini API (mejorado con Files API)
 * Ahora usa el SDK oficial de Google para mejor manejo de contextos grandes
 */
async function callGeminiAPI(messages, systemPrompt) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
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

  // Limitar el contexto según el proveedor
  const MAX_CONTEXT_CHARS = provider === 'gemini' ? 50000 : 12000; // Gemini tiene más capacidad
  const contextLength = context_text ? context_text.length : 0;
  const trimmedContext = contextLength > MAX_CONTEXT_CHARS
    ? context_text.substring(0, MAX_CONTEXT_CHARS) + '\n\n[...Archivo demasiado extenso, contexto truncado por seguridad...]'
    : context_text;

  console.log(`[${provider.toUpperCase()}Telemetry] Context size: ${contextLength} chars -> Trimmed to: ${trimmedContext.length}`);

  const systemMessage = `Eres "Zyren", un tutor académico personal experto y paciente. 
Tu objetivo es responder a las preguntas del estudiante basándote PRINCIPALMENTE en el siguiente material de sus clases (transcripciones, apuntes, documentos).

REGLAS:
1. Usa el contexto proporcionado para fundamentar tus respuestas.
2. Si la respuesta a la pregunta no se encuentra en el contexto, puedes usar tu conocimiento general para ayudar al estudiante, pero debes aclarar que esa información extra no proviene de sus apuntes.
3. Sé didáctico, claro y estructurado (usa viñetas si es necesario).
4. Mantén un tono alentador y profesional.

--- CONTEXTO DE LA MATERIA ---
${trimmedContext || 'El estudiante no proporcionó contexto específico para esta consulta.'}
------------------------------`;

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
                  `http://localhost:${process.env.PORT || 3000}/api/youtube-captions`,
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
 * bloque de texto de contexto académico usando Groq LLaMA.
 *
 * El modelo retorna un array JSON de objetos { front, back } donde:
 *   - front: pregunta o concepto clave
 *   - back:  respuesta o definición concisa
 */
exports.generateFlashcards = async (req, res) => {
  const { context_text, count = 10 } = req.body;

  if (!context_text) {
    return res.status(400).json({ error: 'Falta context_text para generar las flashcards.' });
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return res.status(500).json({ error: 'Groq API Key no está configurada' });
  }

  // Limitar el contexto drásticamente por límites de cuenta (6000 TPM)
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

  try {
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
    let flashcards = [];
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

    res.json({ flashcards, count: flashcards.length });

  } catch (err) {
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

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API Key no está configurada' });
  }

  try {
    console.log(`[ProcessDocument] Archivo: ${documentPath}`);
    console.log(`[ProcessDocument] MIME Type: ${mimeType || 'auto-detect'}`);

    // Usar el servicio geminiService (auto-detecta MIME type)
    const result = await geminiService.processDocumentWithFilesAPI(
      documentPath,
      mimeType, // null = auto-detect
      prompt
    );

    res.json({
      success: true,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
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
 * Ideal para: Crear sets de estudio automáticamente desde materiales
 * 
 * Retorna: Array de objetos { question, answer }
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

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API Key no está configurada' });
  }

  try {
    console.log(`[GenerateFlashcards] ${count} flashcards desde: ${documentPath}`);

    const flashcards = await geminiService.generateFlashcardsFromDocument(
      documentPath,
      mimeType, // null = auto-detect
      count
    );

    res.json({
      success: true,
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      flashcards: flashcards,
      count: flashcards.length,
      supportedFormats: ['.pdf', '.docx', '.doc', '.txt', '.html', '.md'],
      note: 'Flashcards generadas automáticamente desde documento completo'
    });
  } catch (err) {
    console.error('[GenerateFlashcards] Error:', err.message);
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
      model: 'gemini-1.5-flash',
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
