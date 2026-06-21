import * as FileSystem from 'expo-file-system/legacy';
import ThresholdPdfExtractor from '../../modules/threshold-pdf-extractor/src/ThresholdPdfExtractorModule';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

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
    let errorMsg = errBody;
    try {
      const json = JSON.parse(errBody);
      if (json.error?.message) errorMsg = json.error.message;
    } catch {}
    
    const lowerMsg = errorMsg.toLowerCase();
    if (lowerMsg.includes('invalid') && (lowerMsg.includes('api') || lowerMsg.includes('key') || lowerMsg.includes('groq'))) {
      throw new Error('La clave de API de Groq no es válida. Por favor, verifica tu configuración en la sección Motor de IA Local.');
    }
    throw new Error(`Error de Groq Whisper ${response.status}: ${errorMsg}`);
  }

  const rawTranscription = (await response.text()).trim();
  if (!rawTranscription) return '';

  try {
    const body = {
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Eres un experto estructurador de textos académicos. Toma esta transcripción de audio y arréglala. Reglas estrictas:\n1. Agrega la puntuación y capitalización correctas (si faltan).\n2. Separa el texto por semántica.\n3. Identifica palabras clave que den origen a una nueva idea, y usa esas palabras como subtítulos (formato Markdown ###) para crear párrafos separados.\n4. Mantén todo el texto original, no omitas información ni resumas.\n5. No agregues saludos ni despedidas, solo devuelve el texto formateado.'
        },
        {
          role: 'user',
          content: rawTranscription
        }
      ],
      temperature: 0.2,
    };

    const formatResponse = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (formatResponse.ok) {
      const data = await formatResponse.json();
      const formatted = data?.choices?.[0]?.message?.content;
      if (formatted) return formatted;
    }
  } catch (error) {
    console.warn('Error formateando transcripción de audio con Groq:', error);
  }

  return rawTranscription;
}

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

  let safeKey = apiKey ? apiKey.trim() : '';
  if (safeKey.startsWith('ggsk_')) {
    safeKey = safeKey.substring(1); // Auto-fix "ggsk_" typo
  }
  console.log(`[GroqHelpers] summarizeWithGroq - Key starts with: ${safeKey.substring(0, 8)}... Length: ${safeKey.length}`);

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${safeKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let errorMsg = errBody;
    try {
      const json = JSON.parse(errBody);
      if (json.error?.message) errorMsg = json.error.message;
    } catch {}
    
    const lowerMsg = errorMsg.toLowerCase();
    if (lowerMsg.includes('invalid') && (lowerMsg.includes('api') || lowerMsg.includes('key') || lowerMsg.includes('groq'))) {
      throw new Error('La clave de API de Groq no es válida. Por favor, verifica tu configuración en la sección Motor de IA Local.');
    }
    throw new Error(`Error de Groq ${response.status}: ${errorMsg}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? 'No se pudo generar el resumen.';
}

const WHISPER_TINY_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin';
const WHISPER_TINY_FILENAME = 'whisper-tiny.bin';

async function transcribeWithWhisperLocal(audioUri: string): Promise<string> {
  let initWhisper: Function;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    initWhisper = require('whisper.rn').initWhisper;
  } catch {
    throw new Error('whisper.rn no está disponible. Instálalo o usa la transcripción en la nube.');
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useLocalAIStore } = require('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();
  const storedPath = store.downloadedModels['whisper'];

  let modelPath: string;
  if (storedPath) {
    modelPath = storedPath;
  } else {
    modelPath = `${FileSystem.documentDirectory}models/${WHISPER_TINY_FILENAME}`;
    const info = await FileSystem.getInfoAsync(modelPath);
    if (!info.exists) {
      modelPath = `${FileSystem.documentDirectory}${WHISPER_TINY_FILENAME}`;
    }
  }

  const info = await FileSystem.getInfoAsync(modelPath);
  if (!info.exists) {
    if (!store.forceOfflineMode) {
      console.log('[GroqHelpers] Descargando modelo Whisper Tiny (~75 MB)...');

      const dir = modelPath.substring(0, modelPath.lastIndexOf('/'));
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      const download = FileSystem.createDownloadResumable(WHISPER_TINY_URL, modelPath, {});
      const result = await download.downloadAsync();
      if (!result?.uri) {
        throw new Error('No se pudo descargar el modelo Whisper. Verifica tu conexión a internet.');
      }

      useLocalAIStore.getState().markModelDownloaded('whisper', result.uri);
    } else {
      throw new Error('Whisper Tiny no está descargado. Descárgalo desde Configuración > Motor de IA local.');
    }
  }

  const filePath = audioUri.replace(/^file:\/\//, '');
  let fileInfo = await FileSystem.getInfoAsync(filePath);
  if (!fileInfo.exists && audioUri.startsWith('file://')) {
    fileInfo = await FileSystem.getInfoAsync(audioUri);
  }
  if (!fileInfo.exists) {
    throw new Error(
      `Audio file not found: ${filePath}. ` +
      `Intenta con la transcripción en la nube si tienes conexión.`
    );
  }

  let wavUri = audioUri;
  if (!audioUri.toLowerCase().endsWith('.wav')) {
    try {
      wavUri = await ThresholdPdfExtractor.audioToWav(filePath);
      console.log('[GroqHelpers] Audio convertido a WAV para Whisper:', wavUri);
    } catch (convErr: any) {
      throw new Error(
        `No se pudo convertir el audio a WAV para transcripción offline. ` +
        `Detalle: ${convErr?.message || convErr}. ` +
        `Intenta con la transcripción en la nube si tienes conexión.`
      );
    }
  }

  const context = await initWhisper({ filePath: modelPath });
  try {
    const { promise } = context.transcribe(wavUri, {
      language: 'es',
      tokenTimestamps: true,
    });
    const result = await promise;
    return result?.result || '';
  } finally {
    try { await context.release(); } catch {}
    if (wavUri !== audioUri) {
      try {
        await FileSystem.deleteAsync(wavUri, { idempotent: true });
      } catch (_e) {}
    }
  }
}

export async function transcribeWithFallback(
  audioUri: string,
  apiKey?: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useLocalAIStore } = require('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();

  // Ruta local SOLO si el modo offline está forzado explícitamente por el usuario.
  // El campo `activeProvider` puede quedar con valor 'local' de sesiones anteriores
  // aunque haya red; no debe usarse como señal exclusiva para elegir el motor.
  if (store.forceOfflineMode) {
    console.log('[GroqHelpers] Modo offline forzado: usando Whisper local para transcripción.');
    return transcribeWithWhisperLocal(audioUri);
  }

  // Cloud-first: intentar Groq Whisper si hay API key
  if (apiKey) {
    try {
      console.log('[GroqHelpers] Cloud disponible: usando Groq Whisper para transcripción.');
      return await transcribeWithWhisper(audioUri, apiKey);
    } catch (error: any) {
      const isNetworkError =
        error.message?.includes('fetch') ||
        error.message?.includes('Network') ||
        error.message?.includes('ERR_INTERNET') ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('timeout');

      if (!isNetworkError) throw error; // Error de API (clave inválida, etc.) → propagar al usuario

      console.warn('[GroqHelpers] Red no disponible, intentando Whisper local como fallback...');
    }
  } else {
    console.log('[GroqHelpers] Sin API key de Groq: usando Whisper local.');
  }

  return transcribeWithWhisperLocal(audioUri);
}

export async function summarizeWithFallback(
  transcription: string,
  apiKey?: string,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useLocalAIStore } = require('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();

  // Ruta local SOLO si el modo offline está forzado explícitamente.
  if (store.forceOfflineMode) {
    console.log('[GroqHelpers] Modo offline forzado: usando LLM local para resumen.');
    return summarizeWithLocalLLM(transcription);
  }

  // Cloud-first: intentar Groq LLM si hay API key
  if (apiKey) {
    try {
      console.log('[GroqHelpers] Cloud disponible: usando Groq para resumen.');
      return await summarizeWithGroq(transcription, apiKey);
    } catch (error: any) {
      const isNetworkError =
        error.message?.includes('fetch') ||
        error.message?.includes('Network') ||
        error.message?.includes('ERR_INTERNET') ||
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('timeout');

      if (!isNetworkError) throw error; // Error de API → propagar

      console.warn('[GroqHelpers] Red no disponible, intentando resumen local como fallback...');
    }
  } else {
    console.log('[GroqHelpers] Sin API key de Groq: usando LLM local para resumen.');
  }

  return summarizeWithLocalLLM(transcription);
}

async function summarizeWithLocalLLM(transcription: string): Promise<string> {
  const { runInference, loadModel } = require('../services/localInferenceService');
  const { useLocalAIStore } = require('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();

  if (!store.activeModelId) {
    throw new Error('No hay modelo local activo. Actívalo en Configuración > Motor de IA local.');
  }

  console.time('[LocalLLM] loadModel');
  await loadModel(store.activeModelId);
  console.timeEnd('[LocalLLM] loadModel');

  const prompt = `Eres un asistente educativo experto especializado en crear material de estudio universitario. A partir de la transcripción proporcionada, genera un resumen estructurado siguiendo estas reglas:
1. Extrae los conceptos fundamentales y ordénalos por temas usando títulos claros (###).
2. Usa viñetas breves para desglosar los detalles importantes de cada tema.
3. Identifica términos clave y resáltalos en **negrita**.
4. Finaliza con una sección de "Idea Central" de máximo 2 oraciones.
No agregues introducciones conversacionales.

Transcripción:
${transcription}`;

  console.time('[LocalLLM] runInference');
  const result = await runInference({
    prompt,
    temperature: 0.3,
    maxTokens: 384,
  });
  console.timeEnd('[LocalLLM] runInference');

  console.log('[LocalLLM] Tokens generados (aprox):', result.text.split(/\s+/).length);
  return result.text.trim();
}
