import * as FileSystem from 'expo-file-system/legacy';
import { getGrammar, GrammarType } from '../utils/gbnfGrammars';
import { useLocalAIStore, MODELS, hydrationDone } from '../store/useLocalAIStore';
import { getDeviceCapabilities, clearCapabilitiesCache } from '../utils/deviceCapabilities';

let llamaContext: any = null;
let currentModelPath: string | null = null;
let onTokenCallback: ((token: string, accumulated: string, reasoning: string) => void) | null = null;
let streamBuffer = '';
let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
const STREAM_INTERVAL_MS = 16;

export interface InferenceOptions {
  prompt: string;
  grammarType?: GrammarType;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface InferenceResult {
  text: string;
  tokensPerSecond: number;
  modelName: string;
}

export interface StreamCallbacks {
  onToken?: (token: string, accumulated: string, reasoning: string) => void;
}

export function getModelsDirectory(): string {
  return `${FileSystem.documentDirectory}models/`;
}

export function getModelPath(modelId: string): string {
  const info = MODELS[modelId as keyof typeof MODELS];
  if (!info) return '';
  return `${getModelsDirectory()}${info.filename}`;
}

export async function isModelAvailable(modelId: string): Promise<boolean> {
  const path = getModelPath(modelId);
  if (!path) return false;
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

export async function loadModel(modelId: string): Promise<boolean> {
  const store = useLocalAIStore.getState();
  const filePath = store.downloadedModels[modelId];
  if (!filePath) {
    throw new Error('Modelo no encontrado. Descárgalo primero.');
  }

  if (llamaContext && currentModelPath === filePath) {
    store.setInferenceStatus('ready');
    return true;
  }

  if (llamaContext) {
    try { await llamaContext.release(); } catch {}
    llamaContext = null;
    currentModelPath = null;
  }

  store.setInferenceStatus('loading_model');

  try {
    const caps = await getDeviceCapabilities();

    const { initLlama } = require('llama.rn');

    const contextParams: any = {
      model: filePath,
      n_ctx: 2048,
      n_gpu_layers: 99,
      n_threads: caps.recommendedThreads,
      use_mlock: false,
      use_mmap: true,
      cache_type_k: 'q8_0',
      cache_type_v: 'q8_0',
      flash_attn_type: 'auto',
    };

    try {
      llamaContext = await initLlama(contextParams);
    } catch (gpuErr: any) {
      console.warn('[LocalInference] GPU no disponible, usando CPU:', gpuErr?.message || gpuErr);
      contextParams.n_gpu_layers = 0;
      llamaContext = await initLlama(contextParams);
    }

    currentModelPath = filePath;
    store.setInferenceStatus('ready');
    return true;
  } catch (error: any) {
    store.setInferenceStatus('error');
    store.setErrorMessage(`Error al cargar modelo: ${error?.message || 'desconocido'}`);
    throw new Error(`Error al cargar el modelo local: ${error?.message || 'desconocido'}`);
  }
}

export async function unloadModel(): Promise<void> {
  if (llamaContext) {
    try { await llamaContext.release(); } catch {}
    llamaContext = null;
    currentModelPath = null;
  }
  useLocalAIStore.getState().setInferenceStatus('idle');
}

function flushStreamBuffer(): void {
  if (streamFlushTimer) {
    clearTimeout(streamFlushTimer);
    streamFlushTimer = null;
  }
  if (streamBuffer && onTokenCallback) {
    onTokenCallback('', streamBuffer, '');
    streamBuffer = '';
  }
}

export function setStreamCallbacks(callbacks: StreamCallbacks): void {
  onTokenCallback = callbacks.onToken || null;
}

export function clearStreamCallbacks(): void {
  flushStreamBuffer();
  onTokenCallback = null;
}

export async function runInference(
  options: InferenceOptions,
  streamCallbacks?: StreamCallbacks,
): Promise<InferenceResult> {
  const store = useLocalAIStore.getState();
  store.setInferenceStatus('running');
  store.setErrorMessage(null);

  if (!llamaContext) {
    await hydrationDone;
    const freshStore = useLocalAIStore.getState();
    if (freshStore.activeModelId) {
      const loaded = await loadModel(freshStore.activeModelId);
      if (!loaded) {
        throw new Error('No hay modelo local cargado. Actívalo en Configuración > Motor de IA local.');
      }
    } else {
      throw new Error('No hay modelo local activo. Descarga y activa un modelo en Configuración.');
    }
  }

  if (streamCallbacks?.onToken) {
    onTokenCallback = streamCallbacks.onToken;
  }

  const grammar = options.grammarType ? getGrammar(options.grammarType) : '';
  const modelInfo = store.activeModelId ? MODELS[store.activeModelId] : null;

  try {
    const result = await llamaContext.completion(
      {
        prompt: options.prompt,
        grammar: grammar || undefined,
        n_predict: options.maxTokens || 512,
        temperature: options.temperature ?? 0.7,
        stop: options.stop || ['</s>', '<|end|>', '<|eot_id|>'],
      },
      onTokenCallback
        ? (data: any) => {
            if (data?.token) {
              streamBuffer += data.token;
              if (!streamFlushTimer) {
                streamFlushTimer = setTimeout(() => flushStreamBuffer(), STREAM_INTERVAL_MS);
              }
            }
          }
        : undefined,
    );

    flushStreamBuffer();

    const totalTime = result.timings?.predictedMs || 1;
    const tokens = result.tokensEvaluated || 1;
    const tokensPerSecond = (tokens / totalTime) * 1000;

    store.setInferenceStatus('ready');

    return {
      text: result.text.trim(),
      tokensPerSecond,
      modelName: modelInfo?.label || 'desconocido',
    };
  } catch (error: any) {
    flushStreamBuffer();
    store.setInferenceStatus('error');
    store.setErrorMessage(error?.message || 'Error de inferencia');

    const essentialId = 'essential';
    if (store.activeModelId && store.activeModelId !== essentialId && store.downloadedModels[essentialId]) {
      console.warn(`[LocalInference] ⚠️ Modelo "${store.activeModelId}" falló, intentando fallback a essential...`);
      await unloadModel();
      store.setActiveModel(essentialId);
      return runInference(options, streamCallbacks);
    }

    throw error;
  }
}

export function isReady(): boolean {
  return useLocalAIStore.getState().inferenceStatus === 'ready' && llamaContext !== null;
}

export async function cleanup(): Promise<void> {
  clearStreamCallbacks();
  await unloadModel();
  clearCapabilitiesCache();
}
