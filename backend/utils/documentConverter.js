/**
 * documentConverter.js
 *
 * Módulo independiente de conversión de documentos para Gemini.
 *
 * Gemini solo soporta como tipos de inferencia:
 *   - application/pdf        ✅ nativo (visión completa)
 *   - text/plain             ✅ texto plano
 *   - text/html              ✅ texto plano (sin renderizado)
 *   - text/markdown          ✅ texto plano
 *
 * Tipos NO soportados que este módulo convierte automáticamente:
 *   - .docx → text/plain     (via mammoth)
 *   - .doc  → text/plain     (via mammoth, soporte parcial)
 *
 * USO:
 *   const { prepareBufferForGemini } = require('./documentConverter');
 *   const { buffer, mimeType, wasConverted } = await prepareBufferForGemini(fileBuffer, originalMimeType, filename);
 */

const mammoth = require('mammoth');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS QUE GEMINI ACEPTA NATIVAMENTE EN generateContent
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_NATIVE_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/html',
  'text/markdown',
  'text/xml',
  'application/xml',
  // Audio/Video (no usados en este flujo pero listados por completitud)
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/mpeg',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// MIME types que se pueden convertir a texto plano
const CONVERTIBLE_MIMES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un buffer DOCX o DOC a texto plano usando mammoth.
 * @param {Buffer} buffer - Buffer del archivo Word
 * @param {string} mimeType - MIME del archivo original (para logging)
 * @returns {Promise<Buffer>} Buffer con el texto extraído (UTF-8)
 */
async function convertWordToText(buffer, mimeType) {
  try {
    console.log(`[DocumentConverter] Convirtiendo ${mimeType} → text/plain con mammoth...`);

    const result = await mammoth.extractRawText({ buffer });

    if (result.messages && result.messages.length > 0) {
      const warnings = result.messages.filter(m => m.type === 'warning');
      if (warnings.length > 0) {
        console.warn(`[DocumentConverter] Advertencias de mammoth:`, warnings.map(w => w.message).join(', '));
      }
    }

    const extractedText = result.value;

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('El documento Word no contiene texto extraíble o está vacío.');
    }

    console.log(`[DocumentConverter] ✅ Texto extraído: ${extractedText.length} caracteres`);
    return Buffer.from(extractedText, 'utf-8');

  } catch (error) {
    // Re-lanzar con mensaje descriptivo
    throw new Error(`Error convirtiendo documento Word: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifica si un MIME type es directamente soportado por Gemini.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isNativelySupported(mimeType) {
  return GEMINI_NATIVE_MIMES.has(mimeType);
}

/**
 * Verifica si un MIME type puede convertirse a texto antes de enviarse a Gemini.
 * @param {string} mimeType
 * @returns {boolean}
 */
function isConvertible(mimeType) {
  return mimeType in CONVERTIBLE_MIMES;
}

/**
 * Prepara un buffer para enviarse a Gemini.
 * - Si el MIME type es nativo: devuelve el buffer sin cambios.
 * - Si el MIME type es convertible (DOCX/DOC): extrae el texto y lo devuelve como text/plain.
 * - Si no es ninguno de los dos: lanza un error claro.
 *
 * @param {Buffer} fileBuffer - Buffer del archivo original
 * @param {string} mimeType - MIME type del archivo original
 * @param {string} [filename=''] - Nombre del archivo (para logging)
 * @returns {Promise<{buffer: Buffer, mimeType: string, wasConverted: boolean, originalMimeType: string}>}
 */
async function prepareBufferForGemini(fileBuffer, mimeType, filename = '') {
  const logName = filename ? `"${path.basename(filename)}"` : `[${mimeType}]`;

  // Caso 1: Gemini lo soporta nativamente → pasar sin cambios
  if (isNativelySupported(mimeType)) {
    console.log(`[DocumentConverter] ${logName} es nativo (${mimeType}), no requiere conversión.`);
    return {
      buffer: fileBuffer,
      mimeType: mimeType,
      wasConverted: false,
      originalMimeType: mimeType,
    };
  }

  // Caso 2: Convertible (DOCX, DOC) → extraer texto
  if (isConvertible(mimeType)) {
    console.log(`[DocumentConverter] ${logName} requiere conversión: ${mimeType} → text/plain`);
    const textBuffer = await convertWordToText(fileBuffer, mimeType);
    return {
      buffer: textBuffer,
      mimeType: 'text/plain',
      wasConverted: true,
      originalMimeType: mimeType,
    };
  }

  // Caso 3: No soportado ni convertible
  const supported = [...GEMINI_NATIVE_MIMES, ...Object.keys(CONVERTIBLE_MIMES)].join(', ');
  throw new Error(
    `MIME type no soportado: "${mimeType}". ` +
    `Formatos aceptados: PDF, DOCX, DOC, TXT, HTML, Markdown.`
  );
}

/**
 * Prepara un archivo desde ruta para enviarse a Gemini.
 * Detecta si la extensión requiere conversión y aplica el mismo flujo que prepareBufferForGemini.
 *
 * @param {string} filePath - Ruta local al archivo
 * @returns {Promise<{mimeType: string, wasConverted: boolean, originalMimeType: string}>}
 *   Solo devuelve metadatos; el buffer se lee internamente si hay conversión,
 *   pero si no la hay se devuelve la ruta original para que googleAIFileManager la use directamente.
 *
 * Nota: Para archivos de ruta, retorna { needsConversion, convertedBuffer, mimeType }.
 *       El caller decide si subir el buffer convertido o la ruta original.
 */
async function prepareFilePathForGemini(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const EXT_TO_MIME = {
    '.pdf':  'application/pdf',
    '.txt':  'text/plain',
    '.html': 'text/html',
    '.htm':  'text/html',
    '.md':   'text/markdown',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc':  'application/msword',
  };

  const detectedMime = EXT_TO_MIME[ext];
  if (!detectedMime) {
    throw new Error(`Extensión no reconocida: "${ext}". Soportadas: .pdf, .txt, .html, .md, .docx, .doc`);
  }

  // Nativo: no necesita conversión
  if (isNativelySupported(detectedMime)) {
    return {
      needsConversion: false,
      convertedBuffer: null,
      mimeType: detectedMime,
      wasConverted: false,
      originalMimeType: detectedMime,
    };
  }

  // Convertible: leer el archivo y extraer texto
  if (isConvertible(detectedMime)) {
    const fs = require('fs').promises;
    const fileBuffer = await fs.readFile(filePath);
    const textBuffer = await convertWordToText(fileBuffer, detectedMime);
    return {
      needsConversion: true,
      convertedBuffer: textBuffer,
      mimeType: 'text/plain',
      wasConverted: true,
      originalMimeType: detectedMime,
    };
  }

  throw new Error(`Formato no soportado: "${ext}"`);
}

module.exports = {
  prepareBufferForGemini,
  prepareFilePathForGemini,
  isNativelySupported,
  isConvertible,
  GEMINI_NATIVE_MIMES,
  CONVERTIBLE_MIMES,
};
