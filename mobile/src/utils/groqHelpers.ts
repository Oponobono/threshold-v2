import * as FileSystem from 'expo-file-system/legacy';
import ThresholdPdfExtractor from '../../modules/threshold-pdf-extractor/src/ThresholdPdfExtractorModule';
import { obtenerAIClientV2 } from '../services/ai/v2/aiclient';

const WHISPER_TINY_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin';
const WHISPER_TINY_FILENAME = 'whisper-tiny.bin';

async function transcribeWithWhisperLocal(audioUri: string): Promise<string> {
  let initWhisper: Function;
  try {
    initWhisper = require('whisper.rn').initWhisper;
  } catch {
    throw new Error('whisper.rn no está disponible. Instálalo o usa la transcripción en la nube.');
  }

  const { useLocalAIStore } = require('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();
  const storedPath = store.downloadedModels['whisper'];

  let modelPath: string;
  if (storedPath) {
    modelPath = storedPath;
  } else {
    modelPath = \\models/\\;
    const info = await FileSystem.getInfoAsync(modelPath);
    if (!info.exists) {
      modelPath = \\\\;
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

      const download = FileSystem.createDownloadResumable(WHISPER_TINY_URL, modelPath, {
        headers: {
          'User-Agent': 'Threshold/1.0 (React Native; expo-file-system)',
          'Accept-Encoding': 'identity',
        },
      });
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
    throw new Error('Audio file not found: ' + filePath + '. Intenta con la transcripción en la nube si tienes conexión.');
  }

  let wavUri = audioUri;
  if (!audioUri.toLowerCase().endsWith('.wav')) {
    try {
      wavUri = await ThresholdPdfExtractor.audioToWav(filePath);
      console.log('[GroqHelpers] Audio convertido a WAV para Whisper:', wavUri);
    } catch (convErr: any) {
      throw new Error('No se pudo convertir el audio a WAV para transcripción offline.');
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
      } catch {}
    }
  }
}

async function summarizeWithLocalLLM(transcription: string): Promise<string> {
  const { runInference, loadModel } = await import('../services/localInferenceService');
  const { useLocalAIStore } = await import('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();

  if (!store.activeModelId) {
    throw new Error('No hay modelo local activo. Actívalo en Configuración > Motor de IA local.');
  }

  await loadModel(store.activeModelId);

  const prompt = \Eres un asistente educativo experto especializado en crear material de estudio universitario. A partir de la transcripción proporcionada, genera un resumen estructurado siguiendo estas reglas:
1. Extrae los conceptos fundamentales y ordénalos por temas usando títulos claros (###).
2. Usa viñetas breves para desglosar los detalles importantes de cada tema.
3. Identifica términos clave y resáltalos en **negrita**.
4. Finaliza con una sección de "Idea Central" de máximo 2 oraciones.
No agregues introducciones conversacionales.

Transcripción:
\\;

  const result = await runInference({
    prompt,
    temperature: 0.3,
    maxTokens: 384,
  });

  return result.text.trim();
}

export async function transcribeWithFallback(audioUri: string, _ignoredKey?: string): Promise<string> {
  const { useLocalAIStore } = require('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();

  if (store.forceOfflineMode) {
    return transcribeWithWhisperLocal(audioUri);
  }

  try {
    const client = await obtenerAIClientV2();
    const result = await client.transcribeChunked(audioUri);
    if (result.ok) {
      return result.data.content;
    } else {
      if (result.local) {
        console.warn('[GroqHelpers] Backend de IA no disponible, intentando Whisper local...');
        return transcribeWithWhisperLocal(audioUri);
      }
      throw new Error(result.detalle);
    }
  } catch (error) {
    console.warn('[GroqHelpers] Error en transcribir cloud, usando local...', error);
    return transcribeWithWhisperLocal(audioUri);
  }
}

export async function summarizeWithFallback(transcription: string, _ignoredKey?: string): Promise<string> {
  const { useLocalAIStore } = require('../store/useLocalAIStore');
  const store = useLocalAIStore.getState();

  if (store.forceOfflineMode) {
    return summarizeWithLocalLLM(transcription);
  }

  try {
    const client = await obtenerAIClientV2();
    const result = await client.chat([
      { role: 'user', content: \Resume el siguiente texto:\n\n\\ }
    ], 'Eres un asistente educativo experto especializado en crear material de estudio universitario altamente efectivo. A partir de la transcripción proporcionada, genera un resumen estructurado siguiendo estas reglas:\n1. Extrae los conceptos fundamentales y ordénalos por temas usando títulos claros (###).\n2. Usa viñetas breves para desglosar los detalles importantes de cada tema.\n3. Identifica términos clave, definiciones o fechas y resáltalos en **negrita**.\n4. Elimina toda la "paja" (titubeos, saludos, repeticiones) y ve directo al grano.\n5. Finaliza con una sección de "Idea Central" de máximo 2 oraciones.\nTu tono debe ser académico, estructurado y directo. No agregues introducciones conversacionales.');

    if (result.ok) {
      return result.data.content;
    } else {
      if (result.local) {
         console.warn('[GroqHelpers] Backend no disponible, intentando local para resumen...');
         return summarizeWithLocalLLM(transcription);
      }
      throw new Error(result.detalle);
    }
  } catch (error) {
    console.warn('[GroqHelpers] Error en resumen cloud, usando local...', error);
    return summarizeWithLocalLLM(transcription);
  }
}
