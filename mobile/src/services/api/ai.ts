/**
 * ai.ts
 *
 * Servicio de chat conversacional con IA (Groq LLaMA).
 * Envía al backend un historial de mensajes junto con texto de contexto académico
 * (transcripciones, resúmenes, OCR) para obtener una respuesta contextualizada.
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';

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
