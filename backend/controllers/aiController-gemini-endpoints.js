/**
 * Nuevos endpoints para procesamiento avanzado con Gemini Files API
 * 
 * Se agregan al archivo aiController.js
 */

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procesa un documento (PDF, texto largo) usando Gemini Files API
 * Recomendado para archivos grandes (>1MB, PDFs de varias páginas)
 * 
 * Soporta:
 * - application/pdf
 * - text/plain
 * - text/html
 * - application/vnd.openxmlformats-officedocument.wordprocessingml.document
 */
exports.processDocumentWithGemini = async (req, res) => {
  const { documentPath, mimeType = 'application/pdf', prompt } = req.body;

  if (!documentPath || !prompt) {
    return res.status(400).json({ error: 'Falta documentPath o prompt' });
  }

  const geminiApiKey = secrets.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API Key no está configurada' });
  }

  try {
    console.log(`[ProcessDocument] Procesando: ${documentPath} con Gemini Files API`);
    
    // Validar que el archivo existe
    const fileExists = await new Promise(resolve => {
const secrets = require('../config/secrets');
      require('fs').access(documentPath, require('fs').constants.F_OK, err => resolve(!err));
    });

    if (!fileExists) {
      return res.status(400).json({ error: `Archivo no encontrado: ${documentPath}` });
    }

    const result = await processDocumentWithFilesAPI(documentPath, mimeType, prompt);

    res.json({
      success: true,
      provider: 'gemini',
      result,
      model: 'gemini-3-flash-preview',
    });
  } catch (err) {
    console.error('[ProcessDocument] Error:', err);
    res.status(500).json({
      error: 'Error procesando documento con Gemini',
      details: err.message,
    });
  }
};

/**
 * Genera flashcards desde un documento usando Gemini Files API
 * Ideal para PDFs largos y documentos grandes
 */
exports.generateFlashcardsFromDocument = async (req, res) => {
  const { documentPath, mimeType = 'application/pdf', count = 10 } = req.body;

  if (!documentPath) {
    return res.status(400).json({ error: 'Falta documentPath' });
  }

  const geminiApiKey = secrets.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API Key no está configurada' });
  }

  try {
    console.log(`[GenerateFlashcards] Generando ${count} flashcards desde ${documentPath}`);

    const flashcards = await generateFlashcardsFromDocument(
      documentPath,
      mimeType,
      count
    );

    res.json({
      success: true,
      provider: 'gemini',
      flashcards,
      count: flashcards.length,
      model: 'gemini-3-flash-preview',
      note: 'Generado con Gemini 3 Flash Preview - Optimizado para documentos grandes',
    });
  } catch (err) {
    console.error('[GenerateFlashcards] Error:', err);
    res.status(500).json({
      error: 'Error generando flashcards con Gemini',
      details: err.message,
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
