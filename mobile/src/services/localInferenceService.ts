/**
 * localInferenceService.ts
 *
 * Servicio de inferencia local usando llama.rn.
 * Proporciona una interfaz unificada para cargar modelos GGUF,
 * ejecutar prompts con gramáticas GBNF, y gestionar el ciclo de vida
 * del contexto de inferencia.
 *
 * Dependencias nativas:
 *   - llama.rn: bindings de llama.cpp para React Native
 *   - expo-file-system: para localizar modelos descargados
 */
import * as FileSystem from 'expo-file-system/legacy';
import { getGrammar, GrammarType } from '../utils/gbnfGrammars';
import { useLocalAIStore, MODELS, hydrationDone } from '../store/useLocalAIStore';

let llamaContext: any = null;
let currentModelPath: string | null = null;

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

/**
 * Obtiene la ruta del directorio donde se almacenan los modelos descargados.
 */
export function getModelsDirectory(): string {
  return `${FileSystem.documentDirectory}models/`;
}

/**
 * Obtiene la ruta completa de un modelo por su ID.
 */
export function getModelPath(modelId: string): string {
  const info = MODELS[modelId as keyof typeof MODELS];
  if (!info) return '';
  return `${getModelsDirectory()}${info.filename}`;
}

/**
 * Verifica si un modelo está disponible localmente.
 */
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

/**
 * Carga un modelo GGUF en memoria y retorna el contexto de inferencia.
 * Lanza un error si falla, con el mensaje real del problema.
 */
export async function loadModel(modelId: string): Promise<boolean> {
  const store = useLocalAIStore.getState();
  const filePath = store.downloadedModels[modelId];
  if (!filePath) {
    throw new Error('Modelo no encontrado. Descárgalo primero.');
  }

  // Si ya está cargado, no recargar
  if (llamaContext && currentModelPath === filePath) {
    store.setInferenceStatus('ready');
    return true;
  }

  // Liberar contexto anterior
  if (llamaContext) {
    try { await llamaContext.release(); } catch {}
    llamaContext = null;
    currentModelPath = null;
  }

  store.setInferenceStatus('loading_model');

  try {
    const { initLlama } = require('llama.rn');
    llamaContext = await initLlama({
      model: filePath,
      n_ctx: 2048,
      n_gpu_layers: 0,
      n_threads: 4,
      use_mlock: false,
      use_mmap: true,
    });
    currentModelPath = filePath;
    store.setInferenceStatus('ready');
    return true;
  } catch (error: any) {
    store.setInferenceStatus('error');
    store.setErrorMessage(`Error al cargar modelo: ${error?.message || 'desconocido'}`);
    throw new Error(`Error al cargar el modelo local: ${error?.message || 'desconocido'}`);
  }
}

/**
 * Libera el contexto del modelo actual de memoria.
 */
export async function unloadModel(): Promise<void> {
  if (llamaContext) {
    try { await llamaContext.release(); } catch {}
    llamaContext = null;
    currentModelPath = null;
  }
  useLocalAIStore.getState().setInferenceStatus('idle');
}

/**
 * Ejecuta inferencia sobre el modelo cargado actualmente.
 * Aplica gramática GBNF si se especifica para garantizar JSON válido.
 */
export async function runInference(options: InferenceOptions): Promise<InferenceResult> {
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

  const grammar = options.grammarType ? getGrammar(options.grammarType) : '';
  const modelInfo = store.activeModelId ? MODELS[store.activeModelId] : null;

  try {
    const result = await llamaContext.completion({
      prompt: options.prompt,
      grammar: grammar || undefined,
      nPredict: options.maxTokens || 512,
      temperature: options.temperature ?? 0.7,
      stop: options.stop || ['</s>', '<|end|>', '<|eot_id|>'],
    });

    const totalTime = result.timings?.predictMs || 1;
    const tokens = result.tokensEvaluated || 1;
    const tokensPerSecond = (tokens / totalTime) * 1000;

    store.setInferenceStatus('ready');

    return {
      text: result.text.trim(),
      tokensPerSecond,
      modelName: modelInfo?.label || 'desconocido',
    };
  } catch (error: any) {
    store.setInferenceStatus('error');
    store.setErrorMessage(error?.message || 'Error de inferencia');

    // Intentar fallback automático al modelo essential si el actual falló
    const essentialId = 'essential';
    if (store.activeModelId && store.activeModelId !== essentialId && store.downloadedModels[essentialId]) {
      console.warn(`[LocalInference] ⚠️ Modelo "${store.activeModelId}" falló, intentando fallback a essential...`);
      await unloadModel();
      store.setActiveModel(essentialId);
      return runInference(options);
    }

    throw error;
  }
}

/**
 * Verifica si el motor local está listo para inferencia.
 */
export function isReady(): boolean {
  return useLocalAIStore.getState().inferenceStatus === 'ready' && llamaContext !== null;
}

/**
 * Libera recursos al cerrar la app.
 */
export async function cleanup(): Promise<void> {
  await unloadModel();
}
