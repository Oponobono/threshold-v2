/**
 * ai.ts
 *
 * Servicio de chat conversacional con IA (Groq LLaMA).
 * Envía al backend un historial de mensajes junto con texto de contexto académico
 * (transcripciones, resúmenes, OCR) para obtener una respuesta contextualizada.
 */
import { fetchWithFallback, parseJsonSafely } from './client';

/**
 * Envía un mensaje al LLM junto con el contexto académico del usuario.
 * @param contextText - Texto fuente (transcripción, resumen, OCR) que alimenta el sistema prompt.
 * @param messages - Historial de la conversación en formato `{ role, content }[]`.
 */
export const sendAIChatMessage = async (contextText: string, messages: any[]) => {
  try {
    const response = await fetchWithFallback('/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_text: contextText,
        messages: messages,
      }),
    });
    
    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(data?.error || 'Error al comunicarse con la IA');
    }
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Error de red al intentar chatear con la IA');
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
