/**
 * groqHelpers.ts
 *
 * Utilidades para interactuar con las APIs de Groq (OpenAI compatibles).
 * Actualmente utilizado como fallback o alternativa a las implementaciones on-device,
 * enviando audios o textos a los servidores de Groq para su procesamiento ultrarrápido.
 */
import * as FileSystem from 'expo-file-system/legacy';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Transcribe un archivo de audio local usando el modelo Whisper grande (v3) alojado en Groq.
 * @param audioUri - Ruta local al archivo de audio en el dispositivo.
 * @param apiKey - Clave de API de Groq del usuario (desde configuración).
 * @returns El texto transcrito en crudo.
 */
export async function transcribeWithWhisper(audioUri: string, apiKey: string): Promise<string> {
  const fileInfo = await FileSystem.getInfoAsync(audioUri);
  if (!fileInfo.exists) throw new Error('El archivo de audio no existe en el dispositivo.');

  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/mp4',
  } as any);
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'es');
  formData.append('response_format', 'text');

  const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Error de Groq Whisper ${response.status}: ${errBody}`);
  }

  const text = await response.text();
  return text.trim();
}

/**
 * Genera un resumen académico estructurado a partir de una transcripción usando LLaMA 3.
 * Filtra el "ruido" e identifica conceptos clave aplicando Markdown.
 * @param transcription - Texto plano a resumir.
 * @param apiKey - Clave de API de Groq del usuario.
 * @returns El resumen en formato Markdown.
 */
export async function summarizeWithGroq(transcription: string, apiKey: string): Promise<string> {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente educativo experto especializado en crear material de estudio universitario altamente efectivo. A partir de la transcripción proporcionada, genera un resumen estructurado siguiendo estas reglas:\n1. Extrae los conceptos fundamentales y ordénalos por temas usando títulos claros (###).\n2. Usa viñetas breves para desglosar los detalles importantes de cada tema.\n3. Identifica términos clave, definiciones o fechas y resáltalos en **negrita**.\n4. Elimina toda la "paja" (titubeos, saludos, repeticiones) y ve directo al grano.\n5. Finaliza con una sección de "Idea Central" de máximo 2 oraciones.\nTu tono debe ser académico, estructurado y directo. No agregues introducciones conversacionales (como "Aquí tienes el resumen").',
      },
      {
        role: 'user',
        content: `Resume el siguiente texto:\n\n${transcription}`,
      },
    ],
    temperature: 0.3,
  };

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Error de Groq ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? 'No se pudo generar el resumen.';
}
