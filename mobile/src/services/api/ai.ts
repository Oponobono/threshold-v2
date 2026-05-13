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

/**
 * Genera flashcards estructuradas (pares pregunta/respuesta) desde el contexto académico.
 * El backend usa Groq LLaMA para producir un array JSON de { front, back }.
 *
 * @param contextText - Texto de contexto ensamblado por buildAIContext.
 * @param count - Número de flashcards a generar (default: 10).
 */
export const generateFlashcardsFromContext = async (
  contextText: string,
  count: number = 10,
): Promise<{ front: string; back: string }[]> => {
  try {
    const response = await fetchWithFallback('/ai/generate-flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_text: contextText, count }),
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al generar las flashcards con IA');
    }

    return data?.flashcards as { front: string; back: string }[] || [];
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al generar flashcards');
  }
};

/**
 * Procesa un documento cargado directamente (sin guardar en disco).
 * Envía el archivo multipart/form-data a Gemini.
 *
 * @param file - Archivo a procesar (objeto con uri, name, type)
 * @param prompt - Instrucción para procesar el documento
 * @returns Resultado del procesamiento de Gemini
 */
export const processDocumentUpload = async (
  file: { uri: string; name: string; type: string } | any,
  prompt: string,
): Promise<{ result: string; fileName: string; fileSize: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', file as any);
    formData.append('prompt', prompt);

    console.log(`[AI Service] 📄 Procesando documento: ${file.name || 'archivo'}`);

    const response = await fetchWithFallback('/ai/process-document-upload', {
      method: 'POST',
      body: formData,
      // NO incluir Content-Type header — el navegador lo configura automáticamente con boundary
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      console.error(`[AI Service] ❌ Error ${response.status}:`, data);
      throw new Error(data?.error || `Error ${response.status} al procesar documento`);
    }

    console.log(`[AI Service] ✅ Documento procesado exitosamente`);
    return data;
  } catch (error: any) {
    console.error(`[AI Service] Error procesando documento:`, error);
    throw new Error(error.message || 'Error al procesar el documento');
  }
};

/**
 * Genera flashcards desde un archivo cargado directamente.
 * Procesa en memoria con Gemini.
 *
 * @param file - Archivo a procesar (objeto con uri, name, type)
 * @param count - Número de flashcards a generar (default: 10)
 * @returns Array de flashcards { front, back }
 */
export const generateFlashcardsUpload = async (
  file: { uri: string; name: string; type: string } | any,
  count: number = 10,
): Promise<{ front: string; back: string }[]> => {
  try {
    const formData = new FormData();
    formData.append('file', file as any);
    formData.append('count', String(count));

    console.log(`[AI Service] 📚 Generando ${count} flashcards desde: ${file.name || 'archivo'}`);

    const response = await fetchWithFallback('/ai/generate-flashcards-upload', {
      method: 'POST',
      body: formData,
      // NO incluir Content-Type header — el navegador lo configura automáticamente con boundary
    });

    const data = await parseJsonSafely(response);

    if (!response.ok) {
      console.error(`[AI Service] ❌ Error ${response.status}:`, data);
      throw new Error(data?.error || `Error ${response.status} al generar flashcards`);
    }

    console.log(`[AI Service] ✅ ${data.count} flashcards generadas`);
    return data?.flashcards as { front: string; back: string }[] || [];
  } catch (error: any) {
    console.error(`[AI Service] Error generando flashcards:`, error);
    throw new Error(error.message || 'Error al generar flashcards del documento');
  }
};
/**
 * Solicita a Zyren que genere un mazo de material de estudio directamente desde el chat.
 * Crea el mazo en la BD y lo devuelve listo para aparecer en la lista de mazos.
 *
 * @param contextText - Contexto académico de la materia
 * @param mode - Tipo de material: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed'
 * @param count - Número de ítems a generar
 * @param title - Título del mazo
 * @param subjectId - ID de la materia
 * @param userId - ID del usuario
 */
export const generateStudyMaterialFromChat = async (params: {
  contextText: string;
  mode: 'flashcard' | 'multiple_choice' | 'boolean' | 'mixed';
  count: number;
  title: string;
  subjectId: number;
  userId: number;
}) => {
  try {
    const response = await fetchWithFallback('/ai/generate-study-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context_text: params.contextText,
        mode: params.mode,
        count: params.count,
        title: params.title,
        subject_id: params.subjectId,
        user_id: params.userId,
      }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error al generar el material de estudio');
    return data as { id: number; title: string; card_count: number; cards: any[] };
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al generar material');
  }
};

/**
 * Analiza un mazo en busca de conceptos confundibles (Learning Engineering).
 */
export const analyzeDeckConfusions = async (deckId: number | string): Promise<{ suggestions: any[] }> => {
  try {
    const response = await fetchWithFallback(`/ai/deck/${deckId}/confusions`, { method: 'GET' });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error al analizar confusiones');
    return data as { suggestions: any[] };
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al analizar mazo');
  }
};

/**
 * Genera una tarjeta de diferenciación y la añade al mazo.
 */
export const generateDifferentiationCard = async (deckId: number | string, conceptA: string, conceptB: string, reason: string) => {
  try {
    const response = await fetchWithFallback(`/ai/deck/${deckId}/differentiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conceptA, conceptB, reason }),
    });
    const data = await parseJsonSafely(response);
    if (!response.ok) throw new Error(data?.error || 'Error al generar la tarjeta de diferenciación');
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al generar tarjeta');
  }
};
