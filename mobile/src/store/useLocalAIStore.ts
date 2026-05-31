/**
 * useLocalAIStore.ts
 *
 * Store Zustand para el motor de IA local (llama.rn).
 * Gestiona:
 * - Modelos disponibles (descargados), activo y progreso de descarga
 * - Modo offline forzado vs híbrido automático
 * - Estado de inferencia (idle/loading/error)
 * - Almacenamiento usado
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalModelId = 'essential' | 'advanced' | 'qwen_1_5b' | 'qwen_3b' | 'phi3_5' | 'gemma2_2b';
export type DownloadStatus = 'none' | 'downloading' | 'downloaded' | 'error' | 'paused';
export type InferenceStatus = 'idle' | 'loading_model' | 'ready' | 'running' | 'error';
export type AIProvider = 'cloud' | 'local' | 'hybrid';

interface ModelInfo {
  id: LocalModelId;
  label: string;
  labelTag: string;
  description: string;
  downloadSize: string;
  downloadSizeBytes: number;
  ramMin: string;
  capabilities: string[];
  downloadUrl: string;
  filename: string;
}

export const WHISPER_MODEL = {
  id: 'whisper' as const,
  downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  filename: 'whisper-tiny.bin',
  downloadSize: '~75 MB',
  downloadSizeBytes: 75 * 1024 * 1024,
};

export const MODELS: Record<LocalModelId, ModelInfo> = {
  essential: {
    id: 'essential',
    label: 'Modelo Esencial',
    labelTag: 'settings.localAI.essentialLabel',
    description: 'settings.localAI.essentialDesc',
    downloadSize: '~800 MB',
    downloadSizeBytes: 800 * 1024 * 1024,
    ramMin: '1.5 GB',
    capabilities: ['settings.localAI.essentialCap1', 'settings.localAI.essentialCap2', 'settings.localAI.essentialCap3'],
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    filename: 'llama-3.2-1b-q4.gguf',
  },
  advanced: {
    id: 'advanced',
    label: 'Modelo Avanzado',
    labelTag: 'settings.localAI.advancedLabel',
    description: 'settings.localAI.advancedDesc',
    downloadSize: '~2.0 GB',
    downloadSizeBytes: 2 * 1024 * 1024 * 1024,
    ramMin: '3 GB',
    capabilities: ['settings.localAI.advancedCap1', 'settings.localAI.advancedCap2', 'settings.localAI.advancedCap3'],
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    filename: 'llama-3.2-3b-q4.gguf',
  },
  qwen_1_5b: {
    id: 'qwen_1_5b',
    label: 'Qwen 2.5 (1.5B)',
    labelTag: 'settings.localAI.qwen15Label',
    description: 'settings.localAI.qwen15Desc',
    downloadSize: '~1.1 GB',
    downloadSizeBytes: 1.1 * 1024 * 1024 * 1024,
    ramMin: '2 GB',
    capabilities: ['settings.localAI.qwenCap1', 'settings.localAI.qwenCap2', 'settings.localAI.qwenCap3'],
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    filename: 'qwen2.5-1.5b-q4.gguf',
  },
  qwen_3b: {
    id: 'qwen_3b',
    label: 'Qwen 2.5 (3B)',
    labelTag: 'settings.localAI.qwen3Label',
    description: 'settings.localAI.qwen3Desc',
    downloadSize: '~2.2 GB',
    downloadSizeBytes: 2.2 * 1024 * 1024 * 1024,
    ramMin: '3.5 GB',
    capabilities: ['settings.localAI.qwenCap1', 'settings.localAI.qwenCap2', 'settings.localAI.qwenCap3'],
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    filename: 'qwen2.5-3b-q4.gguf',
  },
  phi3_5: {
    id: 'phi3_5',
    label: 'Phi-3.5 Mini (3.8B)',
    labelTag: 'settings.localAI.phiLabel',
    description: 'settings.localAI.phiDesc',
    downloadSize: '~2.4 GB',
    downloadSizeBytes: 2.4 * 1024 * 1024 * 1024,
    ramMin: '4 GB',
    capabilities: ['settings.localAI.phiCap1', 'settings.localAI.phiCap2', 'settings.localAI.phiCap3'],
    downloadUrl: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    filename: 'phi-3.5-mini-q4.gguf',
  },
  gemma2_2b: {
    id: 'gemma2_2b',
    label: 'Gemma 2 (2B)',
    labelTag: 'settings.localAI.gemmaLabel',
    description: 'settings.localAI.gemmaDesc',
    downloadSize: '~1.6 GB',
    downloadSizeBytes: 1.6 * 1024 * 1024 * 1024,
    ramMin: '2.5 GB',
    capabilities: ['settings.localAI.gemmaCap1', 'settings.localAI.gemmaCap2', 'settings.localAI.gemmaCap3'],
    downloadUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    filename: 'gemma-2-2b-q4.gguf',
  },
};

export interface LocalAIState {
  // Modelos descargados: id -> filePath
  downloadedModels: Record<string, string>;
  // Modelo activo (seleccionado para usar)
  activeModelId: LocalModelId | null;
  // Modo offline forzado (ignora conexión, usa local siempre)
  forceOfflineMode: boolean;
  // Proveedor activo (cloud / local / hybrid)
  activeProvider: AIProvider;
  // Estado de inferencia del modelo local
  inferenceStatus: InferenceStatus;
  // Progreso de descarga (0-100)
  downloadProgress: number;
  // Estado de descarga por modelo
  downloadStatus: Record<string, DownloadStatus>;
  // Bytes descargados durante la transferencia
  downloadedBytes: number;
  // Error message
  errorMessage: string | null;
  // Espacio usado por modelos (bytes)
  storageUsedBytes: number;

  // Acciones
  setForceOfflineMode: (enabled: boolean) => void;
  setActiveProvider: (provider: AIProvider) => void;
  setActiveModel: (modelId: LocalModelId | null) => void;
  markModelDownloaded: (modelId: string, filePath: string) => void;
  markModelRemoved: (modelId: string) => void;
  setDownloadProgress: (modelId: string, progress: number, status: DownloadStatus) => void;
  setInferenceStatus: (status: InferenceStatus) => void;
  setErrorMessage: (msg: string | null) => void;
  setStorageUsedBytes: (bytes: number) => void;
  reset: () => void;
}

const STORAGE_KEY_MODELS = '@threshold_local_ai_models';
const STORAGE_KEY_ACTIVE = '@threshold_local_ai_active';
const STORAGE_KEY_FORCED = '@threshold_local_ai_forced';
const STORAGE_KEY_PROVIDER = '@threshold_local_ai_provider';
const STORAGE_KEY_WHISPER = '@threshold_whisper_downloaded';

let _initialized = false;
let _hydrationResolve: () => void;

/**
 * Promesa que se resuelve cuando la hidratación desde AsyncStorage ha terminado.
 * Útil para evitar race conditions donde el store aún no tiene activeModelId.
 */
export const hydrationDone = new Promise<void>((resolve) => {
  _hydrationResolve = resolve;
});

async function persistHydrate(store: { setState: (s: Partial<LocalAIState>) => void; getState: () => LocalAIState }) {
  if (_initialized) { _hydrationResolve(); return; }
  _initialized = true;
  try {
    const [modelsRaw, activeRaw, forcedRaw, providerRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_MODELS),
      AsyncStorage.getItem(STORAGE_KEY_ACTIVE),
      AsyncStorage.getItem(STORAGE_KEY_FORCED),
      AsyncStorage.getItem(STORAGE_KEY_PROVIDER),
    ]);
    store.setState({
      downloadedModels: modelsRaw ? JSON.parse(modelsRaw) : {},
      activeModelId: (activeRaw as LocalModelId) || null,
      forceOfflineMode: forcedRaw === 'true',
      activeProvider: (providerRaw as AIProvider) || 'cloud',
    });
  } catch {
    // Si falla, igual resolvemos para no bloquear
  } finally {
    _hydrationResolve();
  }
}

export const useLocalAIStore = create<LocalAIState>((set, get) => {
  // Hydrate async en el siguiente tick
  setTimeout(() => persistHydrate({ setState: set, getState: get }), 0);

  return {
    downloadedModels: {},
    activeModelId: null,
    forceOfflineMode: false,
    activeProvider: 'cloud',
    inferenceStatus: 'idle',
    downloadProgress: 0,
    downloadStatus: {},
    downloadedBytes: 0,
    errorMessage: null,
    storageUsedBytes: 0,

  setForceOfflineMode: (enabled) => {
    set({ forceOfflineMode: enabled });
    AsyncStorage.setItem(STORAGE_KEY_FORCED, String(enabled));
    if (enabled) {
      set({ activeProvider: 'local' });
      AsyncStorage.setItem(STORAGE_KEY_PROVIDER, 'local');
    }
  },

  setActiveProvider: (provider) => {
    set({ activeProvider: provider });
    AsyncStorage.setItem(STORAGE_KEY_PROVIDER, provider);
  },

  setActiveModel: (modelId) => {
    set({ activeModelId: modelId });
    if (modelId) {
      AsyncStorage.setItem(STORAGE_KEY_ACTIVE, modelId);
    } else {
      AsyncStorage.removeItem(STORAGE_KEY_ACTIVE);
    }
  },

  markModelDownloaded: (modelId, filePath) => {
    const updated = { ...get().downloadedModels, [modelId]: filePath };
    set({ downloadedModels: updated, downloadStatus: { ...get().downloadStatus, [modelId]: 'downloaded' } });
    AsyncStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(updated));
    if (modelId !== 'whisper') {
      get().setActiveModel(modelId as LocalModelId);
    } else {
      AsyncStorage.setItem(STORAGE_KEY_WHISPER, 'true');
    }
  },

  markModelRemoved: (modelId) => {
    const updated = { ...get().downloadedModels };
    delete updated[modelId];
    set({
      downloadedModels: updated,
      downloadStatus: { ...get().downloadStatus, [modelId]: 'none' },
      activeModelId: modelId !== 'whisper' && get().activeModelId === modelId ? null : get().activeModelId,
    });
    AsyncStorage.setItem(STORAGE_KEY_MODELS, JSON.stringify(updated));
    if (modelId === 'whisper') {
      AsyncStorage.removeItem(STORAGE_KEY_WHISPER);
    }
  },

  setDownloadProgress: (modelId, progress, status) => {
    const sizeBytes = modelId === 'whisper'
      ? WHISPER_MODEL.downloadSizeBytes
      : MODELS[modelId as LocalModelId].downloadSizeBytes;
    set({
      downloadProgress: progress,
      downloadStatus: { ...get().downloadStatus, [modelId]: status },
      downloadedBytes: Math.round((progress / 100) * sizeBytes),
    });
  },

  setInferenceStatus: (status) => set({ inferenceStatus: status }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  setStorageUsedBytes: (bytes) => set({ storageUsedBytes: bytes }),

  reset: () => {
    set({
      downloadedModels: {},
      activeModelId: null,
      forceOfflineMode: false,
      activeProvider: 'cloud',
      inferenceStatus: 'idle',
      downloadProgress: 0,
      downloadStatus: {},
      downloadedBytes: 0,
      errorMessage: null,
      storageUsedBytes: 0,
    });
    AsyncStorage.multiRemove([STORAGE_KEY_MODELS, STORAGE_KEY_ACTIVE, STORAGE_KEY_FORCED, STORAGE_KEY_PROVIDER, STORAGE_KEY_WHISPER]);
  },
  };
});
