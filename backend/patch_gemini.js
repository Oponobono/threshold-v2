const fs = require('fs');
const path = require('path');

let content = fs.readFileSync('utils/geminiService.js', 'utf8');

// 1. Update imports
content = content.replace(
  /const secrets = require\('\.\.\/config\/secrets'\);\r?\nconst \{ GoogleGenerativeAI \} = require\("@google\/generative-ai"\);\r?\nconst fs = require\("fs"\)\.promises;\r?\nconst path = require\("path"\);/,
  `const secrets = require('../config/secrets');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");`
);

// 2. processDocumentWithFilesAPI inlineData to GoogleAIFileManager
content = content.replace(
  /    \/\/ Crear objeto para Files API\r?\n    const fileData = \{\r?\n      inlineData: \{\r?\n        data: fileContent\.toString\("base64"\),\r?\n        mimeType: finalMimeType,\r?\n      \},\r?\n    \};/,
  `    // Crear objeto para Files API usando GoogleAIFileManager
    const fileManager = new GoogleAIFileManager(secrets.GEMINI_API_KEY);
    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType: finalMimeType,
      displayName: path.basename(filePath),
    });
    
    console.log(\`[Gemini Files API] Archivo subido exitosamente: \${uploadResult.file.uri}\`);

    const fileData = {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      },
    };`
);

// 3. deleteFile in processDocumentWithFilesAPI
content = content.replace(
  /    const responseText = result\.response\.text\(\);\r?\n    console\.log\(\r?\n      `\[Gemini Files API\] ✅ Respuesta generada \(\$\{responseText\.length\} caracteres\)`\r?\n    \);\r?\n\r?\n    return responseText;/,
  `    const responseText = result.response.text();
    console.log(
      \`[Gemini Files API] ✅ Respuesta generada (\${responseText.length} caracteres)\`
    );

    // Limpieza
    try {
      await fileManager.deleteFile(uploadResult.file.name);
      console.log(\`[Gemini Files API] Archivo temporal eliminado de Gemini\`);
    } catch (e) {
      console.warn(\`[Gemini Files API] No se pudo eliminar archivo de Gemini:\`, e.message);
    }

    return responseText;`
);

// 4. replace the buffer methods
const bufferRegex = /\/\*\*\r?\n \* Procesa un documento desde un buffer en memoria[\s\S]*?(?=\/\*\*\r?\n \* Obtiene información sobre límites y disponibilidad)/;
const replacementBuffer = `/**
 * Sube un buffer a Gemini Files API temporalmente
 */
async function uploadBufferToGemini(fileBuffer, mimeType) {
  const fileManager = new GoogleAIFileManager(secrets.GEMINI_API_KEY);
  const tempFilePath = path.join(os.tmpdir(), \`gemini_temp_\${crypto.randomBytes(8).toString('hex')}\`);
  await fs.writeFile(tempFilePath, fileBuffer);
  
  try {
    const uploadResult = await fileManager.uploadFile(tempFilePath, {
      mimeType: mimeType,
    });
    console.log(\`[Gemini Files API] Buffer subido a Gemini: \${uploadResult.file.uri}\`);
    return { uploadResult, fileManager };
  } finally {
    await fs.unlink(tempFilePath).catch(e => console.warn('Error eliminando temp file:', e.message));
  }
}

/**
 * Procesa un documento desde un buffer en memoria (sin guardar en disco permanentemente)
 * Ideal para: Upload directo desde cliente sin almacenamiento temporal
 *
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} mimeType - MIME type del archivo
 * @param {string} prompt - Instrucción para Gemini
 * @returns {Promise<string>} Respuesta del modelo
 */
async function processDocumentBuffer(fileBuffer, mimeType, prompt) {
  try {
    console.log(\`[Gemini Files API] Procesando buffer en memoria (\${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)\`);
    console.log(\`[Gemini Files API] MIME Type: \${mimeType}\`);

    const { uploadResult, fileManager } = await uploadBufferToGemini(fileBuffer, mimeType);

    const fileData = {
      fileData: {
        fileUri: uploadResult.file.uri,
        mimeType: uploadResult.file.mimeType,
      },
    };

    // Enviar a Gemini
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: \`Eres un asistente académico experto. Procesa este documento completamente sin omitir información.
Responde en español. Si el documento es muy largo, organiza la respuesta de forma clara y estructurada.
Utiliza el contexto completo del documento para dar respuestas precisas.\`,
      safetySettings: SAFETY_SETTINGS,
    });

    console.log(\`[Gemini Files API] Enviando buffer a modelo \${MODEL_NAME}...\`);
    const result = await model.generateContent([fileData, { text: prompt }]);

    const responseText = result.response.text();
    console.log(
      \`[Gemini Files API] ✅ Respuesta generada (\${responseText.length} caracteres)\`
    );

    // Limpieza
    try {
      await fileManager.deleteFile(uploadResult.file.name);
    } catch (e) {
      console.warn(\`[Gemini Files API] No se pudo eliminar archivo:\`, e.message);
    }

    return responseText;
  } catch (error) {
    console.error(\`[Gemini Files API] ❌ Error procesando buffer:\`, error.message);
    throw new Error(\`Error en Gemini Files API: \${error.message}\`);
  }
}

/**
 * Genera flashcards desde un buffer de documento en memoria
 *
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} mimeType - MIME type del archivo
 * @param {number} count - Número de flashcards a generar
 * @returns {Promise<Array>} Array de { front, back }
 */
async function generateFlashcardsFromBuffer(fileBuffer, mimeType, count = 10) {
  try {
    console.log(
      \`[Gemini] Generando \${count} flashcards desde buffer (\${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)\`
    );

    const prompt = \`Eres un experto pedagogo. Analiza este documento y genera exactamente \${count} flashcards de estudio.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional.
2. Cada elemento: { "front": "...", "back": "..." }
3. Preguntas precisas y directas. Respuestas concisas pero completas.
4. Cubre conceptos clave. Evita trivialidades.
5. Formato exacto: [{"front": "...", "back": "..."}, ...]

Genera las flashcards:\`;

    const { uploadResult, fileManager } = await uploadBufferToGemini(fileBuffer, mimeType);

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

    const result = await model.generateContent([fileData, { text: prompt }]);
    const response = result.response.text();

    // Limpieza
    try {
      await fileManager.deleteFile(uploadResult.file.name);
    } catch (e) {
      console.warn(\`[Gemini] No se pudo eliminar archivo:\`, e.message);
    }

    // Parsear respuesta JSON
    const jsonMatch = response.match(/\\[[\\s\\S]*\\]/);
    if (!jsonMatch) {
      throw new Error("Gemini no retornó un array JSON válido");
    }

    const flashcards = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(flashcards)) {
      throw new Error("Respuesta no es un array");
    }

    console.log(
      \`[Gemini] \${flashcards.length} flashcards generadas exitosamente desde buffer\`
    );
    return flashcards;
  } catch (error) {
    console.error(\`[Gemini] Error generando flashcards desde buffer:\`, error.message);
    throw error;
  }
}

`;

content = content.replace(bufferRegex, replacementBuffer);

fs.writeFileSync('utils/geminiService.js', content);
console.log('Patch complete.');
