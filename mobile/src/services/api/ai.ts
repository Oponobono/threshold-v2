/**
 * ai.ts
 *
 * Servicio de chat conversacional con IA.
 * Soporta Groq (velocidad) y Gemini (mayor capacidad).
 * Envía al backend un historial de mensajes junto con texto de contexto académico
 * (transcripciones, resúmenes, OCR) para obtener una respuesta contextualizada.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { LLMProvider, getPreferredLLMProvider } from '../../utils/llmProviderManager';

// --- Anchor Cognitive Types ---
export interface ConfusionSuggestion {
  id: string;
  conceptA: string;
  conceptB: string;
  reason: string;
  confidence: number;
  cardIds: string[];
}

export interface AnchorCardResponse {
  id: string;
  deckId: string | number;
  front: string;
  back: string;
  hint: string | null;
  explanation: string | null;
  itemType: string;
}

/**
 * Envía un mensaje al LLM junto con el contexto académico del usuario.
 * @param contextText - Texto fuente (transcripción, resumen, OCR) que alimenta el sistema prompt.
 * @param messages - Historial de la conversación en formato `{ role, content }[]`.
 * @param sessionId - Opcional. ID de la sesión actual para guardar el historial.
 * @param provider - Opcional. Proveedor LLM ('groq' o 'gemini'). Si no se especifica, usa la preferencia guardada.
 */
export const sendAIChatMessage = async (
  contextText: string,
  messages: any[],
  sessionId?: number,
  provider?: LLMProvider
) => {
  try {
    // Obtener el proveedor preferido si no se especifica
    const selectedProvider = provider || (await getPreferredLLMProvider());
    
    console.log(`[AI Service] 📡 Enviando a ${selectedProvider}...`);
    console.log(`[AI Service] Mensajes: ${messages.length}, Context: ${contextText?.length || 0} chars`);

    const response = await fetchWithFallback(`/ai/chat?provider=${selectedProvider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_text: contextText,
        messages: messages,
        session_id: sessionId,
        provider: selectedProvider,
      }),
    });
    
    const data = await parseJsonSafely(response);
    
    if (!response.ok) {
      console.error(`[AI Service] ❌ Error ${response.status}:`, data);
      const error: any = new Error(data?.error || `Error ${response.status} del servidor`);
      error.details = data?.details;
      error.provider = data?.provider;
      error.status = response.status;
      throw error;
    }
    
    console.log(`[AI Service] ✅ Respuesta exitosa`);
    return data;
  } catch (error: any) {
    console.error(`[AI Service] Error completo:`, {
      message: error.message,
      status: error.status,
      details: error.details,
      provider: error.provider,
    });
    throw new Error(error.message || 'Error de red al intentar chatear con la IA');
  }
};

/**
 * Obtiene el historial de chat de una materia para un usuario.
 */
export const getChatHistory = async (userId: string | number, subjectId: string | number) => {
  try {
    const response = await fetchWithFallback(`/ai/chat/history/${userId}/${subjectId}`);
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al obtener el historial de chat');
    }
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al obtener historial');
  }
};

/**
 * Limpia el historial actual (inicia nueva sesión).
 */
export const clearChatHistory = async (userId: string | number, subjectId: string | number) => {
  try {
    const response = await fetchWithFallback(`/ai/chat/clear/${userId}/${subjectId}`, {
      method: 'POST'
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al limpiar el historial');
    }
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al limpiar historial');
  }
};

/**
 * Solicita al backend construir un bloque de texto de contexto a partir de los items seleccionados.
 * @param items - Lista de items con id, type y label.
 */
export const buildAIContext = async (items: { id: string | number; type: string; label: string }[]) => {
  try {
    const response = await fetchWithFallback('/ai/build-context', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al construir el contexto de IA');
    }
    return data as { context: string; itemsCount: number };
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al construir el contexto');
  }
};

async function generateLocalStudyMaterial(params: {
  contextText: string;
  mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';
  count: number;
  title: string;
  topic?: string;
  subjectId: string;
  userId: string;
}): Promise<{ id: string; title: string; topic?: string; card_count: number; cards: any[] }> {
  const { LocalProvider } = await import('../ai/providers/LocalProvider');
  const provider = new LocalProvider();

  if (!(await provider.isAvailable())) {
    throw new Error('No hay modelo local disponible. Descarga y activa uno en Configuracion > Motor de IA local.');
  }

  const modeLabels: Record<string, string> = {
    flashcard: 'tarjetas de estudio (front/back)',
    multiple_choice: 'preguntas de seleccion multiple',
    boolean: 'preguntas de verdadero/falso',
    mixed: 'mezcla de tarjetas, seleccion multiple y verdadero/falso',
  };

  const systemPrompt =
    'Eres un generador de material de estudio academico. ' +
    'Genera exactamente ' + params.count + ' elementos en formato "' + (params.mode || 'flashcard') + '" (' + (modeLabels[params.mode] || 'tarjetas') + '). ' +
    'Cada elemento debe tener "type" ("flashcard", "multiple_choice" o "true_false") y sus campos correspondientes. ' +
    'Para flashcard: front y back. Para multiple_choice: question, options (array de 4 strings), correct (string exacto de una opcion). ' +
    'Para true_false: statement y answer (boolean). ' +
    'Responde SOLO con un JSON valido con la estructura: {"title":"...","items":[...]}. Nada mas. Sin markdown. Sin explicaciones.';

  const result = await provider.chat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: params.contextText || params.topic || params.title },
    ],
    temperature: 0.3,
    maxTokens: 4096,
  });

  let parsed: any;
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.content);
  } catch {
    throw new Error('El modelo local no pudo generar un JSON valido. Intenta con otro modelo o menos tarjetas.');
  }

  const rawItems: any[] = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  const cards = rawItems.map((item: any) => {
    const type = item.type || 'flashcard';
    if (type === 'multiple_choice') {
      return { type: 'multiple_choice', data: { question: item.question, options: item.options || [], correctIndex: typeof item.correct === 'number' ? item.correct : (item.options || []).indexOf(item.correct) }, hint: item.hint || null, explanation: item.explanation || null, direction: 'forward' };
    }
    if (type === 'true_false') {
      return { type: 'boolean', data: { question: item.statement || item.question, correctAnswer: item.answer }, hint: item.hint || null, explanation: item.explanation || null, direction: 'forward' };
    }
    return { type: 'flashcard', data: { front: item.front || '', back: item.back || '' }, hint: item.hint || null, explanation: item.explanation || null, direction: item.direction || 'bidirectional' };
  });

  return {
    id: 'local-' + Date.now(),
    title: params.title,
    topic: params.topic,
    card_count: cards.length,
    cards,
  };
}

/**
 * Solicita a Zyren que genere un mazo de material de estudio directamente desde el chat.
 * Crea el mazo en la BD y lo devuelve listo para aparecer en la lista de mazos.
 */
export const generateStudyMaterialFromChat = async (params: {
  contextText: string;
  mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';
  count: number;
  title: string;
  topic?: string;
  subjectId: string;
  userId: string;
  provider?: string;
  items?: Array<{ id: string; type: string; label: string; ocr_text?: string; extracted_text?: string }>;
}) => {
  if (params.provider === 'local') {
    return generateLocalStudyMaterial(params);
  }
  try {
    const response = await fetchWithFallback('/ai/capabilities/flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: params.mode,
        count: params.count,
        title: params.title,
        topic: params.topic,
        subject_id: params.subjectId,
        provider: params.provider,
        items: params.items && params.items.length > 0
          ? params.items
          : params.contextText?.trim()
            ? [{ id: 'ctx', type: 'document', label: 'Contexto de conversación', extracted_text: params.contextText }]
            : [],
      }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(`${data?.error || 'Error al generar el material de estudio'}`);
    }
    const deck = data?.deck;
    return {
      id: deck?.id,
      title: deck?.title || params.title,
      topic: deck?.topic ?? params.topic,
      card_count: deck?.cards?.length ?? 0,
      cards: deck?.cards ?? [],
    } as { id: string; title: string; topic?: string; card_count: number; cards: any[] };
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al generar material');
  }
};


/**
 * Analiza un mazo en busca de conceptos confundibles (AI Domain v1.0).
 * Endpoint: GET /api/ai/capabilities/anchor/detect/:deckId
 */
export const analyzeDeckConfusions = async (
  deckId: number | string,
): Promise<{ suggestions: ConfusionSuggestion[] }> => {
  try {
    const response = await fetchWithFallback(`/ai/capabilities/anchor/detect/${deckId}`, { method: 'GET' });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error al analizar confusiones');
    return data as { suggestions: ConfusionSuggestion[] };
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al analizar mazo');
  }
};

/**
 * Genera un Ancla Cognitiva y la persiste en el mazo (AI Domain v1.0).
 * Endpoint: POST /api/ai/capabilities/anchor/generate
 * El id retornado permite persistir localmente con el mismo UUID (Local-First).
 */
export const generateDifferentiationCard = async (
  deckId: number | string,
  conceptA: string,
  conceptB: string,
  reason: string,
  userId?: number | string,
): Promise<AnchorCardResponse> => {
  try {
    const response = await fetchWithFallback('/ai/capabilities/anchor/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deckId, conceptA, conceptB, reason, userId }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error al generar el ancla cognitiva');
    return data as AnchorCardResponse;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al generar ancla cognitiva');
  }
};
