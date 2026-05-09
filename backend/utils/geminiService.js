/**
 * geminiService.js
 *
 * Servicio mejorado para Google Gemini con soporte Files API.
 * Optimizado para:
 * - Documentos grandes (PDFs, archivos >1MB)
 * - Gemini 3 Flash (costo y velocidad óptimos)
 * - Procesamiento estructurado (JSON para flashcards)
 */

const secrets = require('../config/secrets');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const path = require("path");

const genAI = new GoogleGenerativeAI(secrets.GEMINI_API_KEY);
const MODEL_NAME = "gemini-3-flash-preview"; // Modelo recomendado (May 2026): balance ideal entre inteligencia y velocidad

// ✅ SAFETY SETTINGS CORREGIDOS - Usar strings en lugar de objetos HarmCategory
// Las categorías válidas son strings, no objetos de la librería
const SAFETY_SETTINGS = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_CIVIC_INTEGRITY",
    threshold: "BLOCK_NONE",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE ARCHIVO SOPORTADOS POR GEMINI FILES API
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORTED_MIMES = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword", // Word 97-2003 (legado)
  ".md": "text/markdown",
};

const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED_MIMES);
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Detecta el MIME type automáticamente basado en la extensión del archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {string} MIME type correcto
 * @throws {Error} Si la extensión no es soportada
 */
function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (!SUPPORTED_MIMES[ext]) {
    const supported = SUPPORTED_EXTENSIONS.join(", ");
    throw new Error(
      `Archivo no soportado: ${ext}. Soportados: ${supported}`
    );
  }

  return SUPPORTED_MIMES[ext];
}

/**
 * Valida que el archivo exista y tenga tamaño adecuado
 * @param {string} filePath - Ruta del archivo
 * @throws {Error} Si el archivo no existe o es muy grande
 */
async function validateFile(filePath) {
  try {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error(`No es un archivo: ${filePath}`);
    }

    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        `Archivo demasiado grande: ${(stats.size / 1024 / 1024).toFixed(2)}MB. Máximo: 100MB`
      );
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Convierte un archivo local a base64 (para archivos pequeños)
 * @param filePath - Ruta al archivo
 * @returns {Promise<string>} Base64 del contenido
 */
async function fileToBase64(filePath) {
  const fileContent = await fs.readFile(filePath);
  return fileContent.toString("base64");
}

/**
 * Procesa un documento usando Gemini Files API
 * Soporta: PDF, Word, TXT, HTML, Markdown
 * Ideal para: Documentos completos, archivos >1MB, sin truncado de contexto
 *
 * @param {string} filePath - Ruta al archivo local
 * @param {string} mimeType - MIME type (opcional, se auto-detecta si no se proporciona)
 * @param {string} prompt - Instrucción para procesar el documento
 * @returns {Promise<string>} Respuesta del modelo (texto completo sin truncado)
 */
async function processDocumentWithFilesAPI(filePath, mimeType = null, prompt) {
  try {
    console.log(`[Gemini Files API] Iniciando procesamiento: ${path.basename(filePath)}`);

    // Validar archivo
    await validateFile(filePath);

    // Auto-detectar MIME type si no se proporciona
    const finalMimeType = mimeType || detectMimeType(filePath);
    console.log(`[Gemini Files API] Tipo detectado: ${finalMimeType}`);

    // Leer archivo
    const fileContent = await fs.readFile(filePath);
    const fileSize = (fileContent.length / 1024 / 1024).toFixed(2);
    console.log(`[Gemini Files API] Tamaño: ${fileSize}MB`);

    // Crear objeto para Files API
    const fileData = {
      inlineData: {
        data: fileContent.toString("base64"),
        mimeType: finalMimeType,
      },
    };

    // Enviar a Gemini con instrucción del sistema para mejor comprensión
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
    console.log(
      `[Gemini Files API] ✅ Respuesta generada (${responseText.length} caracteres)`
    );

    return responseText;
  } catch (error) {
    console.error(`[Gemini Files API] ❌ Error:`, error.message);
    throw new Error(`Error en Gemini Files API: ${error.message}`);
  }
}

/**
 * Procesa texto en línea (para pequeñas cantidades)
 * Ideal para: Chats, resúmenes cortos, contexto <50KB
 *
 * @param {string} text - Texto a procesar
 * @param {string} prompt - Instrucción
 * @returns {Promise<string>} Respuesta del modelo
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

/**
 * Procesa un chat de contexto académico
 * Usa system instructions para respuestas estructuradas
 *
 * @param {string} contextText - Contexto académico
 * @param {Array} messages - Historial de chat
 * @param {string} systemPrompt - Instrucción del sistema
 * @returns {Promise<Object>} {content: string, model: string}
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
    // ⚠️ IMPORTANTE: El último mensaje debe ser del usuario para sendMessage()
    const contents = [];

    // Agregar todos los mensajes EXCEPTO el último
    if (messages.length > 1) {
      for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Iniciar chat con el histórico
    const chat = model.startChat({ history: contents });

    // Enviar el último mensaje del usuario
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

/**
 * Genera flashcards estructuradas desde un documento
 * Retorna JSON válido para Active Recall
 *
 * @param {string} filePath - Ruta del PDF o documento
 * @param {string} mimeType - MIME type del archivo
 * @param {number} count - Número de flashcards a generar
 * @returns {Promise<Array>} Array de { question, answer }
 */
async function generateFlashcardsFromDocument(filePath, mimeType, count = 10) {
  try {
    console.log(
      `[Gemini] Generando ${count} flashcards desde ${path.basename(filePath)}`
    );

    const prompt = `Eres un experto pedagogo. Analiza este documento y genera exactamente ${count} flashcards de estudio.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional.
2. Cada elemento: { "question": "...", "answer": "..." }
3. Preguntas precisas y directas. Respuestas concisas pero completas.
4. Cubre conceptos clave. Evita trivialidades.
5. Formato exacto: [{"question": "...", "answer": "..."}, ...]

Genera las flashcards:`;

    const response = await processDocumentWithFilesAPI(
      filePath,
      mimeType,
      prompt
    );

    // Parsear respuesta JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Gemini no retornó un array JSON válido");
    }

    const flashcards = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(flashcards)) {
      throw new Error("Respuesta no es un array");
    }

    console.log(
      `[Gemini] ${flashcards.length} flashcards generadas exitosamente`
    );
    return flashcards;
  } catch (error) {
    console.error(`[Gemini] Error generando flashcards:`, error.message);
    throw error;
  }
}

/**
 * Procesa un documento desde un buffer en memoria (sin guardar en disco)
 * Ideal para: Upload directo desde cliente sin almacenamiento temporal
 *
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} mimeType - MIME type del archivo
 * @param {string} prompt - Instrucción para Gemini
 * @returns {Promise<string>} Respuesta del modelo
 */
async function processDocumentBuffer(fileBuffer, mimeType, prompt) {
  try {
    console.log(`[Gemini Files API] Procesando buffer en memoria (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
    console.log(`[Gemini Files API] MIME Type: ${mimeType}`);

    // Crear objeto para Files API desde buffer
    const fileData = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType,
      },
    };

    // Enviar a Gemini
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
    console.log(
      `[Gemini Files API] ✅ Respuesta generada (${responseText.length} caracteres)`
    );

    return responseText;
  } catch (error) {
    console.error(`[Gemini Files API] ❌ Error procesando buffer:`, error.message);
    throw new Error(`Error en Gemini Files API: ${error.message}`);
  }
}

/**
 * Genera flashcards desde un buffer de documento en memoria (sin guardar en disco)
 * Ideal para: Upload directo desde cliente
 *
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} mimeType - MIME type del archivo
 * @param {number} count - Número de flashcards a generar
 * @returns {Promise<Array>} Array de { front, back }
 */
async function generateFlashcardsFromBuffer(fileBuffer, mimeType, count = 10) {
  try {
    console.log(
      `[Gemini] Generando ${count} flashcards desde buffer (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`
    );

    const prompt = `Eres un experto pedagogo. Analiza este documento y genera exactamente ${count} flashcards de estudio.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional.
2. Cada elemento: { "front": "...", "back": "..." }
3. Preguntas precisas y directas. Respuestas concisas pero completas.
4. Cubre conceptos clave. Evita trivialidades.
5. Formato exacto: [{"front": "...", "back": "..."}, ...]

Genera las flashcards:`;

    const fileData = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType,
      },
    };

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: SAFETY_SETTINGS,
    });

    const result = await model.generateContent([fileData, { text: prompt }]);
    const response = result.response.text();

    // Parsear respuesta JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Gemini no retornó un array JSON válido");
    }

    const flashcards = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(flashcards)) {
      throw new Error("Respuesta no es un array");
    }

    console.log(
      `[Gemini] ${flashcards.length} flashcards generadas exitosamente desde buffer`
    );
    return flashcards;
  } catch (error) {
    console.error(`[Gemini] Error generando flashcards desde buffer:`, error.message);
    throw error;
  }
}

/**
 * Procesa un documento desde un buffer en memoria (sin guardar en disco)
 * Ideal para: Upload directo desde cliente sin almacenamiento temporal
 *
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} mimeType - MIME type del archivo
 * @param {string} prompt - Instrucción para Gemini
 * @returns {Promise<string>} Respuesta del modelo
 */
async function processDocumentBuffer(fileBuffer, mimeType, prompt) {
  try {
    console.log(`[Gemini Files API] Procesando buffer en memoria (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);
    console.log(`[Gemini Files API] MIME Type: ${mimeType}`);

    // Crear objeto para Files API desde buffer
    const fileData = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType,
      },
    };

    // Enviar a Gemini
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
    console.log(
      `[Gemini Files API] ✅ Respuesta generada (${responseText.length} caracteres)`
    );

    return responseText;
  } catch (error) {
    console.error(`[Gemini Files API] ❌ Error procesando buffer:`, error.message);
    throw new Error(`Error en Gemini Files API: ${error.message}`);
  }
}

/**
 * Obtiene información sobre límites y disponibilidad
 */
function getModelInfo() {
  return {
    model: MODEL_NAME,
    features: ["Files API", "Chat history", "System instructions", "JSON mode"],
    maxContextTokens: 1000000, // 1M tokens para Gemini 3 Flash
    maxFileSize: 1024 * 1024 * 100, // 100 MB
    fileRetention: "48 horas", // Los archivos se eliminan después de 48 horas
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
  getModelInfo,
  MODEL_NAME,
};
