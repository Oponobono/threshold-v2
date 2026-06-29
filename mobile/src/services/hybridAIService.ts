import { chatCapability } from './ai/capabilities/ChatCapability';
import { flashcardCapability } from './ai/capabilities/FlashcardCapability';
import { ocrCapability } from './ai/capabilities/OCRCapability';
import { pdfCapability } from './ai/capabilities/PDFCapability';
import { transcriptionCapability } from './ai/capabilities/TranscriptionCapability';
import { aiOrchestrator } from './ai/AIOrchestrator';
import { aiExecutionPolicy, ExecutionPolicy } from './ai/AIExecutionPolicy';
import { resolveProvider } from '../utils/llmProviderManager';

export function chunkAudioDuration(audioDurationMs: number, maxChunkMinutes: number = 15): number {
  const maxChunkMs = maxChunkMinutes * 60 * 1000;
  if (audioDurationMs <= maxChunkMs) return 1;
  return Math.ceil(audioDurationMs / maxChunkMs);
}

export async function sequentialAudioProcess(
  audioUri: string,
  llmPrompt: string,
  onStreamToken?: (token: string, accumulated: string, reasoning: string) => void,
): Promise<{ transcription: string; response: string }> {
  const transcription = await transcriptionCapability.transcribe(audioUri);
  const response = await aiOrchestrator.execute({
    messages: [{ role: 'user', content: llmPrompt }],
    maxTokens: 1024,
    temperature: 0.3,
    stream: !!onStreamToken,
    onStreamToken: onStreamToken as any,
  });
  return { transcription: transcription.text, response: response.content };
}

export async function sendHybridChatMessage(
  contextText: string,
  messages: { role: string; content: string }[],
  sessionId?: number,
  provider?: string,
  onStreamToken?: (token: string, accumulated: string, reasoning: string) => void,
) {
  const resolved = await resolveProvider();
  if (!resolved) {
    throw new Error('No hay conexión a internet ni modelo local disponible. Activa un modelo en Configuración > Motor de IA local.');
  }

  const lastMsg = messages.filter(m => m.role === 'user').pop();
  const result = await chatCapability.chat({
    message: lastMsg?.content || '',
    history: messages.slice(0, -1).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    subjectContext: contextText,
    onStreamToken: onStreamToken as any,
  });

  return {
    reply: { content: result.content },
    model: `${result.provider}:${result.model}`,
    ...(result.deckAction ? { deck: result.deckAction } : {}),
  };
}

export async function getChatHistory(userId: string | number, subjectId: string | number) {
  try {
    const { getChatHistory: cloudGetHistory } = await import('./api/ai');
    const result = await cloudGetHistory(userId, subjectId);
    try {
      const { createMMKV } = await import('react-native-mmkv');
      const mmkv = createMMKV();
      mmkv.set(`cache:chat_history:${userId}:${subjectId}`, JSON.stringify(result));
    } catch { }
    return result;
  } catch {
    try {
      const { createMMKV } = await import('react-native-mmkv');
      const mmkv = createMMKV();
      const raw = mmkv.getString(`cache:chat_history:${userId}:${subjectId}`);
      if (raw) return JSON.parse(raw);
    } catch { }
    return { session_id: undefined, messages: [] };
  }
}

export async function clearChatHistory(userId: string | number, subjectId: string | number) {
  try {
    const { createMMKV } = await import('react-native-mmkv');
    const mmkv = createMMKV();
      mmkv.remove(`cache:chat_history:${userId}:${subjectId}`);
  } catch { }
  try {
    const { clearChatHistory: cloudClearHistory } = await import('./api/ai');
    return await cloudClearHistory(userId, subjectId);
  } catch {
    return { success: true };
  }
}

export async function buildAIContextHybrid(items: any[]) {
  let contextParts: string[] = [];
  for (const item of items) {
    const text = item.extracted_text || item.ocr_text || item.transcript_text;
    if (text && text.trim().length > 0) {
      const typeLabel = item.type === 'document' ? 'Documento' : item.type === 'photo' ? 'Foto/Imagen' : item.type === 'video' ? 'Video' : 'Grabación';
      contextParts.push(`--- Inicio de ${typeLabel}: ${item.label} ---\n${text.trim()}\n--- Fin de ${typeLabel} ---`);
    }
  }
  return { context: contextParts.join('\n\n'), itemsCount: contextParts.length };
}

export async function generateHybridFlashcards(contextText: string, count: number = 5) {
  const cards = await flashcardCapability.generate({ text: contextText, count, mode: 'flashcard' });
  return { success: true, data: { flashcards: cards, model: 'hybrid' } };
}

export async function generateHybridStudyMaterial(params: {
  contextText: string;
  mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';
  count: number;
  title: string;
  subjectId: number;
  userId: number;
}) {
  const cards = await flashcardCapability.generate({ text: params.contextText, count: params.count, mode: params.mode });
  return { id: 0, title: params.title, card_count: cards.length, cards };
}

export async function analyzeDeckConfusionsHybrid(deckId: number | string) {
  const { fetchWithFallback } = await import('./api/client');
  try {
    const response = await fetchWithFallback(`/ai/deck/${deckId}/confusions`);
    if (response.ok) return await response.json();
  } catch { }
  return { suggestions: [] };
}

export async function generateDifferentiationCardHybrid(
  deckId: number | string,
  conceptA: string,
  conceptB: string,
  reason: string,
) {
  const { fetchWithFallback } = await import('./api/client');
  try {
    const response = await fetchWithFallback(`/ai/deck/${deckId}/differentiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptA, conceptB, reason }),
    });
    if (response.ok) return await response.json();
  } catch { }
  return { front: '', back: '' };
}

export async function summarizeHybrid(text: string, title?: string) {
  const response = await aiOrchestrator.execute({
    messages: [
      { role: 'system', content: `Resume el siguiente texto académico${title ? ` ("${title}")` : ''}. Devuelve SOLO un JSON válido con: title, keyPoints (array), conclusion.` },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    maxTokens: 1024,
  });
  try {
    return JSON.parse(response.content);
  } catch {
    return { title: title || '', keyPoints: [], conclusion: response.content };
  }
}

export async function extractTextFromImageHybrid(base64Image: string): Promise<string> {
  const result = await ocrCapability.extractFromImage(base64Image);
  return result.text;
}

export async function extractTextFromPDFHybrid(base64Pdf: string): Promise<string> {
  const result = await pdfCapability.extract(base64Pdf);
  return result.text;
}

export async function generateFlashcardsFromImageHybrid(payload: { imageBase64?: string; imageUri?: string; sourceLanguage?: string; targetLanguage?: string; count?: number }) {
  const imageSource = payload.imageBase64 || payload.imageUri || '';
  const ocrText = await extractTextFromImageHybrid(imageSource);
  if (!ocrText || ocrText.trim().length === 0) {
    return { success: false, error: 'No se pudo extraer texto de la imagen' };
  }
  const cards = await flashcardCapability.generate({ text: ocrText, count: payload.count || 5 });
  return { success: true, flashcards: cards, ocr_text: ocrText };
}

export async function processDocumentUploadHybrid(fileUri: string, prompt: string) {
  try {
    const { fetchWithFallback } = await import('./api/client');
    const formData = new FormData();
    formData.append('file', { uri: fileUri, type: 'application/pdf', name: 'document.pdf' } as any);
    formData.append('prompt', prompt);
    const response = await fetchWithFallback('/ai/process-document-upload', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Upload failed');
    return await response.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function isHybridAIAvailable(): boolean {
  return true;
}

export async function generateClassFlashcardsHybrid(params: { courseName?: string; subjectName: string; currentMilestone?: string; rawTextFromOCROrNotes: string }) {
  try {
    const { fetchWithFallback } = await import('./api/client');
    const res = await fetchWithFallback('/ai/class-flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Error en el servidor');
    return await res.json();
  } catch (error: any) {
    const isNetworkError = error.message?.includes('fetch') || error.message?.includes('Network');
    if (!isNetworkError) throw error;
    const cards = await flashcardCapability.generate({ text: params.rawTextFromOCROrNotes, count: 10 });
    return { cards, count: cards.length, topic: params.subjectName };
  }
}

export { aiExecutionPolicy, ExecutionPolicy };
export { aiOrchestrator };
