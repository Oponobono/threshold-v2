/**
 * geminiService.js
 *
 * Servicio mejorado para Google Gemini con soporte Files API.
 * Optimizado para:
 * - Documentos grandes (PDFs, archivos >1MB)
 * - Gemini 3 Flash (costo y velocidad óptimos)
 * - Procesamiento estructurado (JSON para flashcards)
 *
 * Formatos soportados:
 *   - PDF    → nativo (visión completa)
 *   - TXT    → nativo (texto plano)
 *   - HTML   → nativo (texto plano sin renderizado)
 *   - MD     → nativo (texto plano)
 *   - DOCX   → convertido automáticamente a text/plain via documentConverter
 *   - DOC    → convertido automáticamente a text/plain via documentConverter
 */

const secrets = require('../config/secrets');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// Módulo de conversión de formatos no soportados (DOCX/DOC → text/plain)
const { prepareBufferForGemini, prepareFilePathForGemini } = require('./documentConverter');

// Módulo de fragmentación atómica (Cognitive Load Theory)
const { analyzeCardDensity, fragmentCard } = require('./atomicCardGenerator');

// Módulo de construcción de prompts académicos de calidad (Taxonomía de Bloom)
const { buildAdaptivePrompt, buildSystemPrompt } = require('./academicPromptBuilder');

const genAI = new GoogleGenerativeAI(secrets.GEMINI_API_KEY);
const MODEL_NAME = "gemini-3-flash-preview"; // Modelo recomendado (May 2026)

// ✅ SAFETY SETTINGS - strings en lugar de objetos HarmCategory
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_CIVIC_INTEGRITY",    threshold: "BLOCK_NONE" },
];

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE ARCHIVO (referencia para validación y auto-detección)
// DOCX/DOC se mantienen aquí para que detectMimeType los reconozca,
// pero serán convertidos por documentConverter antes de enviarse a Gemini.
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORTED_MIMES = {
  ".pdf":  "application/pdf",
  ".txt":  "text/plain",
  ".html": "text/html",
  ".htm":  "text/html",
  ".md":   "text/markdown",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc":  "application/msword",
};

const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED_MIMES);
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Detecta el MIME type automáticamente basado en la extensión del archivo.
 * @param {string} filePath
 * @returns {string} MIME type
 */
function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_MIMES[ext]) {
    throw new Error(
      `Archivo no soportado: ${ext}. Soportados: ${SUPPORTED_EXTENSIONS.join(", ")}`
    );
  }
  return SUPPORTED_MIMES[ext];
}

/**
 * Valida que el archivo exista y tenga tamaño adecuado.
 * @param {string} filePath
 */
async function validateFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw new Error(`No es un archivo: ${filePath}`);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        `Archivo demasiado grande: ${(stats.size / 1024 / 1024).toFixed(2)}MB. Máximo: 100MB`
      );
    }
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Archivo no encontrado: ${filePath}`);
    throw error;
  }
}

/**
 * Convierte un archivo local a base64 (para archivos pequeños).
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function fileToBase64(filePath) {
  const fileContent = await fs.readFile(filePath);
  return fileContent.toString("base64");
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: uploadBufferToGemini
// Sube un buffer al Files API. Aplica conversión automática si es necesario.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sube un buffer a Gemini Files API temporalmente.
 * Aplica conversión automática si el MIME type no es soportado nativamente (ej. DOCX → text/plain).
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimeType - MIME type original
 * @param {string} [filename=''] - Nombre del archivo (para logging)
 * @returns {Promise<{uploadResult, fileManager, wasConverted: boolean, finalMimeType: string}>}
 */
async function uploadBufferToGemini(fileBuffer, mimeType, filename = '') {
  const fileManager = new GoogleAIFileManager(secrets.GEMINI_API_KEY);

  // Conversión automática si es DOCX/DOC (documentConverter devuelve text/plain)
  const prepared = await prepareBufferForGemini(fileBuffer, mimeType, filename);

  if (prepared.wasConverted) {
    console.log(`[Gemini Files API] Conversión aplicada: ${prepared.originalMimeType} → ${prepared.mimeType}`);
  }

  // Extensión para el temp file según el MIME final
  const tempExt = prepared.mimeType === 'text/plain' ? '.txt' : '';
  const tempFilePath = path.join(
    os.tmpdir(),
    `gemini_temp_${crypto.randomBytes(8).toString('hex')}${tempExt}`
  );
  await fs.writeFile(tempFilePath, prepared.buffer);

  try {
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: prepared.mimeType,
    });
    console.log(`[Gemini Files API] Buffer subido a Gemini: ${uploadResult.file.uri}`);
    return {
      uploadResult,
      fileManager,
      wasConverted: prepared.wasConverted,
      finalMimeType: prepared.mimeType,
    };
  } finally {
    await fs.unlink(tempFilePath).catch(e =>
      console.warn('Error eliminando temp file:', e.message)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL: processDocumentWithFilesAPI (desde ruta local)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procesa un documento usando Gemini Files API.
 * Soporta: PDF, Word (.docx/.doc), TXT, HTML, Markdown.
 * Los DOCX/DOC son convertidos a text/plain automáticamente antes de subirse.
 *
 * @param {string} filePath - Ruta al archivo local
 * @param {string|null} mimeType - MIME type (opcional, se auto-detecta)
 * @param {string} prompt - Instrucción para procesar el documento
 * @returns {Promise<string>} Respuesta del modelo
 */
async function processDocumentWithFilesAPI(filePath, mimeType = null, prompt) {
  try {
    console.log(`[Gemini Files API] Iniciando procesamiento: ${path.basename(filePath)}`);

    await validateFile(filePath);

    // Verificar si necesita conversión (DOCX/DOC → text/plain)
    const conversionInfo = await prepareFilePathForGemini(filePath);
    console.log(`[Gemini Files API] Tipo: ${conversionInfo.originalMimeType}${conversionInfo.wasConverted ? ' → ' + conversionInfo.mimeType : ' (nativo)'}`);

    const fileManager = new GoogleAIFileManager(secrets.GEMINI_API_KEY);
    let uploadResult;

    if (conversionInfo.needsConversion) {
      // DOCX/DOC: subir el buffer de texto convertido via archivo temporal
      const tempPath = path.join(
        os.tmpdir(),
        `gemini_converted_${crypto.randomBytes(8).toString('hex')}.txt`
      );
      await fs.writeFile(tempPath, conversionInfo.convertedBuffer);
      try {
        uploadResult = await fileManager.uploadFile(tempPath, {
          mimeType: conversionInfo.mimeType,
          displayName: path.basename(filePath) + ' (converted)',
        });
      } finally {
        await fs.unlink(tempPath).catch(e =>
          console.warn('[Gemini Files API] No se pudo borrar temp convertido:', e.message)
        );
      }
    } else {
      // PDF / TXT / HTML / MD: subir el archivo original directamente
      const fileContent = await fs.readFile(filePath);
      console.log(`[Gemini Files API] Tamaño: ${(fileContent.length / 1024 / 1024).toFixed(2)}MB`);
      uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: conversionInfo.mimeType,
        displayName: path.basename(filePath),
      });
    }

    console.log(`[Gemini Files API] Archivo subido: ${uploadResult.file.uri}`);

    const fileData = {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      },
    };

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: `Eres un asistente académico experto. Procesa este documento completamente sin omitir información.
Responde en español. Si el documento es muy largo, organiza la respuesta de forma clara y estructurada.
Utiliza el contexto completo del documento para dar respuestas precisas.`,
      safetySettings: SAFETY_SETTINGS,
    });

    console.log(`[Gemini Files API] Enviando a modelo ${MODEL_NAME}...`);
    const result = await model.generateContent([fileData, { text: prompt }]);
    const responseText = result.response.text();
    console.log(`[Gemini Files API] ✅ Respuesta generada (${responseText.length} caracteres)`);

    // Limpieza del archivo en Gemini
    try {
      await fileManager.deleteFile(uploadResult.file.name);
      console.log(`[Gemini Files API] Archivo temporal eliminado de Gemini`);
    } catch (e) {
      console.warn(`[Gemini Files API] No se pudo eliminar archivo de Gemini:`, e.message);
    }

    return responseText;
  } catch (error) {
    console.error(`[Gemini Files API] ❌ Error:`, error.message);
    throw new Error(`Error en Gemini Files API: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// processTextInline — para contextos pequeños (<50KB)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procesa texto en línea (para pequeñas cantidades).
 * Ideal para: Chats, resúmenes cortos, contexto <50KB.
 *
 * @param {string} text
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function processTextInline(text, prompt) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: SAFETY_SETTINGS,
    });
    const result = await model.generateContent([{ text: `${text}\n\n${prompt}` }]);
    return result.response.text();
  } catch (error) {
    console.error(`[Gemini] Error procesando texto:`, error.message);
    throw new Error(`Error en Gemini Text: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// processAcademicChat — chat con historial
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procesa un chat de contexto académico con historial de mensajes.
 *
 * @param {string} contextText - Contexto académico
 * @param {Array} messages - Historial de chat
 * @param {string} systemPrompt - Instrucción del sistema
 * @returns {Promise<{content: string, model: string}>}
 */
async function processAcademicChat(contextText, messages, systemPrompt) {
  try {
    console.log(`[Gemini] Iniciando chat académico con ${messages.length} mensajes`);
    console.log(`[Gemini] Usando modelo: ${MODEL_NAME}`);

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemPrompt,
      safetySettings: SAFETY_SETTINGS,
    });

    // Convertir formato OpenAI a formato Gemini
    // ⚠️ El último mensaje debe ser del usuario para sendMessage()
    const contents = [];
    if (messages.length > 1) {
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }
    }

    const chat = model.startChat({ history: contents });

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") {
      throw new Error("El último mensaje debe ser del usuario");
    }

    const result = await chat.sendMessage(lastMsg.content);
    const responseText = result.response.text();
    console.log(`[Gemini] ✅ Respuesta de chat generada (${responseText.length} chars)`);

    return {
      content: responseText,
      model: MODEL_NAME,
      provider: "gemini",
    };
  } catch (error) {
    console.error(`[Gemini] ❌ Error en chat académico:`, error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFlashcardsFromDocument — desde ruta local
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera flashcards estructuradas desde un documento.
 * Retorna JSON válido para Active Recall con estructura pedagógica alta calidad.
 * Incluye: tipo, contenido, pista (hint) y explicación profunda.
 *
 * @param {string} filePath - Ruta del PDF o documento
 * @param {string} mimeType - MIME type del archivo
 * @param {number} count - Número de flashcards a generar
 * @returns {Promise<Array>} Array de { type, data: { front, back }, hint, explanation }
 */
async function generateFlashcardsFromDocument(filePath, mimeType, count = 10) {
  try {
    console.log(`[Gemini] Generando ${count} flashcards desde ${path.basename(filePath)}`);

    // Construir prompt con estándares académicos de Taxonomía de Bloom
    const systemPrompt = buildSystemPrompt('flashcard', count, 'General', 'posgrado');
    
    // Agregar instrucción específica para documentos
    const finalPrompt = `${systemPrompt}

DOCUMENTO A ANALIZAR:
[documento adjunto]

Basándote primariamente en el contenido del documento. Si el usuario solicita incluir temas relacionados o conexos (ej: "incluye hantavirus" cuando el documento trata coronavirus), PUEDES incorporarlos como contexto académico complementario que enriquece el aprendizaje.

Genera los ${count} flashcards.
Asegura que cada flashcard sea de NIVEL COGNITIVO ALTO (Análisis/Síntesis/Evaluación).`;

    const response = await processDocumentWithFilesAPI(filePath, mimeType, finalPrompt);

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Gemini no retornó un array JSON válido");

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items)) throw new Error("Respuesta no es un array");

    const atomicItems = processAtomicFlashcards(items);

    console.log(`[Gemini] ✅ ${atomicItems.length} flashcards generadas exitosamente (Originales: ${items.length})`);
    return atomicItems;
  } catch (error) {
    console.error(`[Gemini] Error generando flashcards:`, error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// processDocumentBuffer — desde buffer en memoria (upload directo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procesa un documento desde un buffer en memoria.
 * Aplica conversión automática para DOCX/DOC.
 * Ideal para: Upload directo desde cliente sin almacenamiento temporal.
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {string} prompt
 * @param {string} [filename=''] - Nombre del archivo (para logging)
 * @returns {Promise<string>}
 */
async function processDocumentBuffer(fileBuffer, mimeType, prompt, filename = '') {
  try {
    console.log(`[Gemini Files API] Procesando buffer (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
    console.log(`[Gemini Files API] MIME Type: ${mimeType}`);

    const { uploadResult, fileManager, wasConverted, finalMimeType } =
      await uploadBufferToGemini(fileBuffer, mimeType, filename);

    if (wasConverted) {
      console.log(`[Gemini Files API] Documento convertido a ${finalMimeType} para procesamiento`);
    }

    const fileData = {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      },
    };

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: `Eres un asistente académico experto. Procesa este documento completamente sin omitir información.
Responde en español. Si el documento es muy largo, organiza la respuesta de forma clara y estructurada.
Utiliza el contexto completo del documento para dar respuestas precisas.`,
      safetySettings: SAFETY_SETTINGS,
    });

    console.log(`[Gemini Files API] Enviando buffer a modelo ${MODEL_NAME}...`);
    const result = await model.generateContent([fileData, { text: prompt }]);
    const responseText = result.response.text();
    console.log(`[Gemini Files API] ✅ Respuesta generada (${responseText.length} caracteres)`);

    // Limpieza
    try {
      await fileManager.deleteFile(uploadResult.file.name);
    } catch (e) {
      console.warn(`[Gemini Files API] No se pudo eliminar archivo:`, e.message);
    }

    return responseText;
  } catch (error) {
    console.error(`[Gemini Files API] ❌ Error procesando buffer:`, error.message);
    throw new Error(`Error en Gemini Files API: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFlashcardsFromBuffer — desde buffer en memoria
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera flashcards desde un buffer de documento en memoria.
 * Aplica conversión automática para DOCX/DOC.
 * Usa prompts de calidad académica con estructura pedagógica.
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimeType
 * @param {number} count
 * @param {string} [filename='']
 * @returns {Promise<Array>} Array de { type, data, hint, explanation }
 */
async function generateFlashcardsFromBuffer(fileBuffer, mimeType, count = 10, filename = '') {
  try {
    console.log(
      `[Gemini] Generando ${count} flashcards desde buffer (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`
    );

    // Construir prompt con estándares académicos de Taxonomía de Bloom
    const systemPrompt = buildSystemPrompt('mixed', count, 'General', 'posgrado');
    
    const finalPrompt = `${systemPrompt}

DOCUMENTO A ANALIZAR:
[documento adjunto]

Genera exactamente ${count} ítems mezclados (40% MC, 40% Flashcard, 20% V/F).
Cada ítem debe incluir: type, data, hint, explanation.
CERO meta-datos. CERO trivialidades. TODO análisis/síntesis/evaluación.`;

    const { uploadResult, fileManager, wasConverted, finalMimeType } =
      await uploadBufferToGemini(fileBuffer, mimeType, filename);

    if (wasConverted) {
      console.log(`[Gemini] Documento convertido a ${finalMimeType} para flashcards`);
    }

    const fileData = {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      },
    };

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: SAFETY_SETTINGS,
    });

    const result = await model.generateContent([fileData, { text: finalPrompt }]);
    const response = result.response.text();

    // Limpieza
    try {
      await fileManager.deleteFile(uploadResult.file.name);
    } catch (e) {
      console.warn(`[Gemini] No se pudo eliminar archivo:`, e.message);
    }

    // Parsear respuesta JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Gemini no retornó un array JSON válido");

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items)) throw new Error("Respuesta no es un array");

    const atomicItems = processAtomicFlashcards(items);

    console.log(`[Gemini] ✅ ${atomicItems.length} ítems generados exitosamente desde buffer (Originales: ${items.length})`);
    return atomicItems;
  } catch (error) {
    console.error(`[Gemini] Error generando flashcards desde buffer:`, error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFlashcardsFromText — desde texto plano (sin archivo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera flashcards estructuradas desde un bloque de texto (sin necesidad de archivo).
 * Usa prompts de CALIDAD ACADÉMICA ALTA con Taxonomía de Bloom.
 * Incluye: pistas pedagógicas (hints) y explicaciones magistrales.
 * Llamado por el endpoint /api/ai/generate-flashcards cuando provider=gemini.
 *
 * @param {string} contextText - Texto de contexto académico
 * @param {number} count - Número de flashcards a generar
 * @returns {Promise<Array>} Array de { type, data: { front/back o question/options }, hint, explanation }
 */
async function generateFlashcardsFromText(contextText, count = 10) {
  try {
    console.log(`[Gemini] Generando ${count} flashcards desde texto (${contextText.length} chars)`);

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: SAFETY_SETTINGS,
    });

    // Auto-detectar disciplina y usar prompt especializado
    const systemPrompt = buildAdaptivePrompt('mixed', count, contextText, 'posgrado');

    const finalPrompt = `${systemPrompt}

═══════════════════════════════════════════════════════════════════════════════
MATERIAL ACADÉMICO A ANALIZAR:
═══════════════════════════════════════════════════════════════════════════════

${contextText}

═══════════════════════════════════════════════════════════════════════════════
ACCIÓN:
═══════════════════════════════════════════════════════════════════════════════

Genera exactamente ${count} ítems de evaluación.
Distribución: 40% Opción Múltiple + 40% Flashcard + 20% Verdadero/Falso

REQUISITOS OBLIGATORIOS:
✅ CADA ítem tiene: "type", "data" (con sus propios campos), "hint", "explanation"
✅ CERO preguntas sobre metadatos del documento
✅ TODA pregunta es de nivel Análisis/Síntesis/Evaluación (Bloom 4-6)
✅ Distractores son errores conceptuales REALES de la disciplina
✅ Pistas son empujones al razonamiento (NO respuestas disfrazadas)
✅ Explicaciones son lecciones magistrales que ENSEÑAN, no solo confirman

Responde ÚNICAMENTE el array JSON. CERO texto adicional.`;

    const result = await model.generateContent([{ text: finalPrompt }]);
    const response = result.response.text();

    // Parsear respuesta JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Gemini no retornó un array JSON válido');

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items)) throw new Error('Respuesta no es un array');

    // Validar estructura de cada ítem
    const validItems = items.filter(item => {
      if (!item.type || !item.data) {
        console.warn('[Gemini] Ítem ignorado: estructura incompleta', item);
        return false;
      }
      if (!item.hint || !item.explanation) {
        console.warn('[Gemini] Ítem sin pista o explicación:', item.type);
      }
      return true;
    });

    const atomicItems = processAtomicFlashcards(validItems);

    console.log(`[Gemini] ✅ ${atomicItems.length} ítems generados desde texto (calidad académica verificada)`);
    return atomicItems;
  } catch (error) {
    console.error(`[Gemini] Error generando flashcards desde texto:`, error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// generateFlashcardsWithGroq — fallback para Groq con prompts simplificados
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera flashcards usando Groq (fallback o alternativa a Gemini)
 * Usa prompts simplificados que Groq maneja mejor
 * 
 * @param {string} contextText - Texto académico
 * @param {number} count - Cantidad de ítems
 * @returns {Promise<Array>} Items con estructura { type, data, hint, explanation }
 */
async function generateFlashcardsWithGroq(contextText, count = 10) {
  const { buildGroqPrompt } = require('./academicPromptBuilder');
  
  try {
    console.log(`[Groq] Generando ${count} flashcards con prompts académicos simplificados...`);
    
    const groqApiKey = secrets.GROQ_API_KEY;
    if (!groqApiKey) throw new Error('Groq API Key no está configurada');

    const systemPrompt = buildGroqPrompt('mixed', count);
    
    // Limitar contexto para Groq
    const trimmedContext = contextText.length > 8000
      ? contextText.substring(0, 8000) + '\n[...truncado]'
      : contextText;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Contexto académico:\n${trimmedContext}` },
        ],
        temperature: 0.5,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Groq API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const groqData = await response.json();
    const rawContent = groqData.choices?.[0]?.message?.content || '{}';

    // Parsear JSON
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Groq no retornó array JSON válido');

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items)) throw new Error('Respuesta no es un array');

    const atomicItems = processAtomicFlashcards(items);

    console.log(`[Groq] ✅ ${atomicItems.length} ítems generados exitosamente (Originales: ${items.length})`);
    return atomicItems;
  } catch (error) {
    console.error(`[Groq] Error generando flashcards:`, error.message);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO & UTILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intercepta los items generados por la IA y aplica fragmentación atómica
 * a las tarjetas de tipo 'flashcard' que sean demasiado densas.
 */
function processAtomicFlashcards(items) {
  const finalItems = [];
  for (const item of items) {
    if (item.type !== 'flashcard' || !item.data) {
      finalItems.push(item);
      continue;
    }
    
    // Legacy support para flashcards antiguas que podrían venir sin 'front'
    const front = item.data.front || item.data.question || '';
    const back = item.data.back || item.data.answer || '';
    
    const density = analyzeCardDensity({ front, back });
    
    if (density.isDense) {
      console.log(`[Atomic] Fragmentando flashcard densa generada por IA: ${front.substring(0, 30)}...`);
      const atomicCards = fragmentCard({ front, back });
      for (const atomic of atomicCards) {
        finalItems.push({
          type: 'flashcard',
          data: { front: atomic.front, back: atomic.back },
          hint: item.hint,
          explanation: item.explanation,
          is_atomic: 1
        });
      }
    } else {
      finalItems.push(item);
    }
  }
  return finalItems;
}

/**
 * Obtiene información sobre límites y disponibilidad del modelo.
 */
function getModelInfo() {
  return {
    model: MODEL_NAME,
    features: ["Files API", "Chat history", "System instructions", "JSON mode"],
    maxContextTokens: 1000000,
    maxFileSize: 1024 * 1024 * 100, // 100 MB
    fileRetention: "48 horas",
    nativeMimeTypes: ["application/pdf", "text/plain", "text/html", "text/markdown"],
    convertedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document (→ text/plain)",
      "application/msword (→ text/plain)",
    ],
    costOptimization: "Extremadamente eficiente para PDFs y documentos",
  };
}

module.exports = {
  processDocumentWithFilesAPI,
  processDocumentBuffer,
  processTextInline,
  processAcademicChat,
  generateFlashcardsFromDocument,
  generateFlashcardsFromBuffer,
  generateFlashcardsFromText,
  generateFlashcardsWithGroq,
  getModelInfo,
  MODEL_NAME,
};
