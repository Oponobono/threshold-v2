/**
 * hybridAIService.ts
 *
 * Servicio híbrido que enruta peticiones de IA al proveedor
 * apropiado según la disponibilidad:
 *
 *   1. Cloud (Groq/Gemini) → cuando hay conexión y no está forzado local
 *   2. Local (llama.rn)    → cuando está en modo offline forzado,
 *                             no hay conexión, o el usuario eligió local
 *
 * Cada función replica la interfaz de las funciones en ai.ts para
 * ser un reemplazo directo.
 */
import i18n from '../locales/i18n';
import { sendAIChatMessage as cloudSendChat } from './api/ai';
import { runInference, loadModel, isReady } from './localInferenceService';
import { resolveProvider } from '../utils/llmProviderManager';
import { useLocalAIStore, hydrationDone } from '../store/useLocalAIStore';
import type { LLMProvider } from '../utils/llmProviderManager';

// ───────────────────────────────────────────
//  Helpers internos
// ───────────────────────────────────────────

function getSystemPrompt(): string {
  return `Eres Zyren, un asistente académico especializado en análisis, interpretación y transformación de material académico en conocimiento estructurado. Responde en el mismo idioma en que te hablan (español o inglés). Tus respuestas deben ser claras, concisas y académicamente rigurosas.`;
}

async function ensureLocalModel(): Promise<void> {
  if (isReady()) return;
  await hydrationDone;
  const store = useLocalAIStore.getState();
  if (store.activeModelId) {
    await loadModel(store.activeModelId);
    return;
  }
  throw new Error('No hay un modelo activo. Descarga y activa un modelo en Configuración > Motor de IA local.');
}

function buildChatPrompt(messages: { role: string; content: string }[], contextText?: string): string {
  let prompt = getSystemPrompt() + '\n\n';
  if (contextText) {
    prompt += `Contexto académico:\n${contextText}\n\n`;
  }
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'Zyren' : 'Usuario';
    prompt += `${role}: ${msg.content}\n`;
  }
  prompt += `Zyren:`;
  return prompt;
}

// ───────────────────────────────────────────
//  API híbrida
// ───────────────────────────────────────────

/**
 * Envía un mensaje al chat de IA usando el proveedor resuelto.
 */
export async function sendHybridChatMessage(
  contextText: string,
  messages: { role: string; content: string }[],
  sessionId?: number,
  provider?: LLMProvider,
) {
  const baseResolved = await resolveProvider();
  const resolved = baseResolved === 'local' ? 'local' : (provider || baseResolved);

  if (!resolved) {
    throw new Error('No hay conexión a internet ni modelo local disponible. Activa un modelo en Configuración > Motor de IA local.');
  }

  if (resolved === 'local') {
    await ensureLocalModel();
    const prompt = buildChatPrompt(messages, contextText);
    const result = await runInference({
      prompt,
      maxTokens: 1024,
      temperature: 0.7,
      stop: ['Usuario:', '\n\nUsuario'],
    });
    // Normalizar al mismo formato que el endpoint cloud
    return {
      reply: { content: result.text },
      model: `local:${result.modelName}`,
      tokensPerSecond: result.tokensPerSecond,
    };
  }

  return cloudSendChat(contextText, messages, sessionId, resolved);
}

/**
 * Obtiene el historial de chat (siempre desde cloud).
 */
export { getChatHistory, clearChatHistory } from './api/ai';

/**
 * Construye contexto académico (siempre desde cloud).
 */
export { buildAIContext } from './api/ai';

/**
 * Genera flashcards desde texto usando el proveedor resuelto.
 */
export async function generateHybridFlashcards(contextText: string, count: number = 5) {
  const resolved = await resolveProvider();

  if (!resolved) {
    throw new Error('No hay conexión a internet ni modelo local disponible.');
  }

  if (resolved === 'local') {
    await ensureLocalModel();

    // Para generar flashcards offline necesitamos la info completa del prompt
    const prompt = `${getSystemPrompt()}

Genera exactamente ${count} flashcards académicas sobre el siguiente contenido. Cada flashcard debe tener:
- front: la pregunta o término
- back: la respuesta o definición  
- topic: la categoría temática
- tags: un array de etiquetas relevantes

Devuelve SOLO un array JSON válido, sin texto adicional.

Contenido:
${contextText}`;

    const result = await runInference({
      prompt,
      grammarType: 'flashcards',
      temperature: 0.3,
      maxTokens: 2048,
    });

    try {
      const flashcards = JSON.parse(result.text);
      return {
        success: true,
        data: { flashcards, model: `local:${result.modelName}` },
      };
    } catch {
      // Si falla parsing, devolver como texto
      return {
        success: true,
        data: { flashcards: [{ front: 'Error de formato', back: result.text, topic: '', tags: [] }], model: `local:${result.modelName}` },
      };
    }
  }

  // Cloud: importar función original
  const { generateFlashcardsFromContext } = require('./api/ai');
  return generateFlashcardsFromContext(contextText, count);
}

/**
 * Genera material de estudio híbrido.
 */
export async function generateHybridStudyMaterial(params: {
  contextText: string;
  mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';
  count: number;
  title: string;
  subjectId: number;
  userId: number;
}) {
  const resolved = await resolveProvider();

  if (!resolved) {
    throw new Error('No hay conexión a internet ni modelo local disponible.');
  }

  if (resolved === 'local') {
    await ensureLocalModel();
    const prompt = `${getSystemPrompt()}

Genera material de estudio en formato JSON a partir del siguiente contenido. El modo es "${params.mode}".
Devuelve SOLO un JSON válido con estructura { title, items }.

Contenido:
${params.contextText || ''}`;

    const result = await runInference({
      prompt,
      grammarType: 'study_material',
      temperature: 0.3,
      maxTokens: 2048,
    });

    try {
      const data = JSON.parse(result.text);
      return { id: 0, title: params.title, card_count: data.items?.length || 0, cards: data.items || [] };
    } catch {
      return { id: 0, title: params.title, card_count: 0, cards: [] };
    }
  }

  const { generateStudyMaterialFromChat } = require('./api/ai');
  return generateStudyMaterialFromChat(params);
}

/**
 * Analiza confusiones de un deck.
 */
export async function analyzeDeckConfusionsHybrid(deckId: number | string) {
  const resolved = await resolveProvider();

  if (!resolved) {
    throw new Error('No hay conexión a internet ni modelo local disponible.');
  }

  if (resolved === 'local') {
    await ensureLocalModel();
    const prompt = `${getSystemPrompt()}
Analiza el deck de flashcards con ID ${deckId} y devuelve un JSON con las confusiones más comunes entre conceptos.
Devuelve SOLO un JSON válido.`;
    const result = await runInference({
      prompt,
      grammarType: 'confusions',
      temperature: 0.3,
      maxTokens: 1024,
    });
    try {
      const parsed = JSON.parse(result.text);
      return { suggestions: parsed.confusions || [] };
    } catch {
      return { suggestions: [] };
    }
  }

  const { analyzeDeckConfusions } = require('./api/ai');
  return analyzeDeckConfusions(deckId);
}

/**
 * Genera tarjeta de diferenciación.
 */
export async function generateDifferentiationCardHybrid(
  deckId: number | string,
  conceptA: string,
  conceptB: string,
  reason: string,
) {
  const resolved = await resolveProvider();

  if (!resolved) {
    throw new Error('No hay conexión a internet ni modelo local disponible.');
  }

  if (resolved === 'local') {
    await ensureLocalModel();
    const prompt = `${getSystemPrompt()}
Genera una tarjeta de diferenciación entre "${conceptA}" y "${conceptB}".
Razón: ${reason}
Devuelve SOLO un JSON válido con: conceptA, conceptB, difference, example.`;
    const result = await runInference({
      prompt,
      grammarType: 'differentiation',
      temperature: 0.3,
      maxTokens: 1024,
    });
    try {
      return JSON.parse(result.text);
    } catch {
      return { conceptA, conceptB, difference: result.text, example: '' };
    }
  }

  const { generateDifferentiationCard } = require('./api/ai');
  return generateDifferentiationCard(deckId, conceptA, conceptB, reason);
}

/**
 * Genera resumen de contenido híbrido.
 */
export async function summarizeHybrid(text: string, title?: string) {
  const resolved = await resolveProvider();

  if (!resolved) {
    throw new Error('No hay conexión a internet ni modelo local disponible.');
  }

  if (resolved === 'local') {
    await ensureLocalModel();
    const prompt = `${getSystemPrompt()}
Resume el siguiente texto académico${title ? ` ("${title}")` : ''}.
Devuelve SOLO un JSON válido con: title, keyPoints (array), conclusion.`;
    const result = await runInference({
      prompt,
      grammarType: 'summary',
      temperature: 0.3,
      maxTokens: 1024,
    });
    try {
      return { success: true, data: JSON.parse(result.text) };
    } catch {
      return { success: true, data: { title: title || 'Resumen', keyPoints: [result.text], conclusion: '' } };
    }
  }

  const { summarizeWithGroq } = require('../utils/groqHelpers');
  const result = await summarizeWithGroq(text, '');
  return { success: true, data: result };
}

/**
 * Extrae texto de una imagen (OCR) con ruteo híbrido.
 *
 * - Cloud: llama al endpoint /ocr del backend (Groq Vision).
 * - Local: usa Google ML Kit (Android) / Vision Framework (iOS) vía
 *   @react-native-ml-kit/text-recognition, 100% offline.
 *
 * Respeta el interruptor forceOfflineMode y la conectividad.
 */
export async function extractTextFromImageHybrid(base64Image: string): Promise<string> {
  const resolved = await resolveProvider();

  const tryLocal = async (): Promise<string> => {
    const { extractTextFromImageLocal } = require('./localOCRService');
    return extractTextFromImageLocal(base64Image);
  };

  const tryCloud = async (): Promise<string> => {
    const { extractTextFromImage } = require('./api/documents');
    return extractTextFromImage(base64Image);
  };

  if (!resolved) {
    return tryLocal();
  }

  if (resolved === 'local') {
    try {
      return await tryLocal();
    } catch (localError) {
      console.warn('[extractTextFromImageHybrid] Local OCR failed, trying cloud:', localError);
      return tryCloud();
    }
  }

  try {
    return await tryCloud();
  } catch (cloudError) {
    console.warn('[extractTextFromImageHybrid] Cloud OCR failed, trying local:', cloudError);
    return tryLocal();
  }
}

/**
 * Extrae texto de un PDF con ruteo híbrido.
 *
 * - Cloud: endpoint /pdf-extract del backend.
 * - Local: módulo nativo con PDFKit (iOS) / PDFBox-Android.
 *
 * Respeta forceOfflineMode.
 */
export async function extractTextFromPDFHybrid(base64Pdf: string): Promise<string> {
  const resolved = await resolveProvider();

  const tryLocal = async (): Promise<string> => {
    const { extractTextFromPdfLocal } = require('./localPDFService');
    return extractTextFromPdfLocal(base64Pdf);
  };

  const tryCloud = async (): Promise<string> => {
    const { extractTextFromPDF } = require('./api/documents');
    return extractTextFromPDF(base64Pdf);
  };

  if (!resolved) {
    return tryLocal();
  }

  if (resolved === 'local') {
    try {
      return await tryLocal();
    } catch (localError) {
      console.warn('[extractTextFromPDFHybrid] Local extraction failed, trying cloud:', localError);
      return tryCloud();
    }
  }

  try {
    return await tryCloud();
  } catch (cloudError) {
    console.warn('[extractTextFromPDFHybrid] Cloud extraction failed, trying local:', cloudError);
    return tryLocal();
  }
}

/**
 * Genera flashcards desde una imagen con ruteo híbrido.
 *
 * - Cloud: endpoint /flashcard-decks/generate-from-image (Groq Vision).
 * - Local: convierte la imagen a texto vía ML Kit y luego genera
 *   flashcards con el LLM local.
 *
 * Respeta forceOfflineMode.
 */
export async function generateFlashcardsFromImageHybrid(payload: {
  image_base64: string;
  count: number;
  title: string;
  subject_id: number;
  user_id: number;
  mode?: string;
}) {
  const resolved = await resolveProvider();

  if (!resolved) {
    throw new Error(i18n.t('documents.noAiAvailable', { feature: 'generación de flashcards desde imagen' }));
  }

  if (resolved === 'local') {
    // 1. Extraer texto de la imagen con ML Kit
    const { extractTextFromImageLocal } = require('./localOCRService');
    const ocrText = await extractTextFromImageLocal(payload.image_base64);

    if (!ocrText) {
      throw new Error(i18n.t('documents.ocrNoTextDetected'));
    }

    // 2. Generar flashcards desde el texto con el LLM local
    return generateHybridFlashcards(ocrText, payload.count);
  }

  const { generateFlashcardsFromImage } = require('./api/flashcards');
  return generateFlashcardsFromImage(payload);
}

/**
 * Procesa un documento subido (PDF/imagen) para contexto de chat.
 *
 * - Cloud: endpoint /ai/process-document-upload (Gemini).
 * - Local: extrae texto del documento con módulo nativo y lo devuelve
 *   como contexto plano para el LLM local.
 *
 * Respeta forceOfflineMode.
 */
export async function processDocumentUploadHybrid(
  file: { uri: string; name: string; type: string },
  prompt: string,
): Promise<{ result: string; fileName: string; fileSize: string }> {
  const resolved = await resolveProvider();

  // 1. Siempre extraer texto localmente (offline) para no enviar el archivo
  const FileSystem = require('expo-file-system/legacy');
  const fileContent = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  let text = '';
  if (file.type?.includes('pdf')) {
    const { extractTextFromPdfLocal } = require('./localPDFService');
    text = await extractTextFromPdfLocal(fileContent);
  } else {
    const { extractTextFromImageLocal } = require('./localOCRService');
    text = await extractTextFromImageLocal(fileContent);
  }

  if (!text || !text.trim()) {
    throw new Error('No se pudo extraer texto del documento localmente.');
  }

  const fileSizeKB = Math.round((fileContent.length * 3) / 4 / 1024);

  // 2. Analizar SOLAMENTE el texto usando el modelo híbrido
  // Si no hay red y no hay modelo local, devuelve el texto plano como fallback
  if (!resolved) {
    return {
      result: `[Texto extraído sin análisis (Offline)]\n\n${text}`,
      fileName: file.name,
      fileSize: `${fileSizeKB} KB`,
    };
  }

  const chatResponse = await sendHybridChatMessage(text, [{ role: 'user', content: prompt }]);

  return {
    result: chatResponse?.reply?.content || `[Texto extraído]\n\n${text}`,
    fileName: file.name,
    fileSize: `${fileSizeKB} KB`,
  };
}

/**
 * Determina si Zyren (chat u otras funciones) está disponible actualmente.
 */
export function isHybridAIAvailable(): boolean {
  const store = useLocalAIStore.getState();
  const { useConnectivityStore } = require('../store/useConnectivityStore');
  const isOnline = useConnectivityStore.getState().isOnline;
  return isOnline || (store.activeModelId !== null && store.inferenceStatus !== 'error');
}
