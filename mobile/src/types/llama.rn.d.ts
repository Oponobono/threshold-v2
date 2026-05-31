declare module 'llama.rn' {
  export interface LlamaContextOptions {
    modelPath: string;
    nCtx?: number;
    nGpuLayers?: number;
    nThreads?: number;
    seed?: number;
    useMlock?: boolean;
    useMmap?: boolean;
  }

  export interface LlamaCompletionOptions {
    prompt: string;
    grammar?: string;
    nPredict?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    stop?: string[];
    cachePrompt?: boolean;
  }

  export interface LlamaCompletionResult {
    text: string;
    tokensEvaluated: number;
    timings: {
      promptEvalMs: number;
      tokenEvalMs: number;
      predictMs: number;
    };
  }

  export interface LlamaContext {
    completion: (options: LlamaCompletionOptions) => Promise<LlamaCompletionResult>;
    stop: () => void;
    release: () => Promise<void>;
    getModelInfo: () => { description: string; file: string; type: string };
  }

  export interface LlamaModelInfo {
    defaultPath: string;
    defaultNCtx: number;
    supportsGpu: boolean;
  }

  export function initLlama(options: LlamaContextOptions): Promise<LlamaContext>;
  export function getDefaultModelPath(filename: string): string;
  export function isNpuSupported(): boolean;
}
