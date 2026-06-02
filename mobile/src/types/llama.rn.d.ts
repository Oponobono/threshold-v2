declare module 'llama.rn' {
  export type NativeSpeculativeType = 'none' | 'draft-mtp' | 'mtp'
  export type NativeSpeculativeParams = {
    enabled?: boolean
    type?: NativeSpeculativeType
    types?: Array<NativeSpeculativeType>
    n_max?: number
    n_min?: number
    p_min?: number
    p_split?: number
    draft?: {
      n_max?: number
      n_min?: number
      p_min?: number
      p_split?: number
    }
  }
  export type NativeSpeculativeConfig = NativeSpeculativeParams | NativeSpeculativeType | boolean

  export interface NativeContextParams {
    model: string
    chat_template?: string
    is_model_asset?: boolean
    use_progress_callback?: boolean
    n_ctx?: number
    n_batch?: number
    n_ubatch?: number
    n_parallel?: number
    n_threads?: number
    cpu_mask?: string
    cpu_strict?: boolean
    n_gpu_layers?: number
    devices?: Array<string>
    no_gpu_devices?: boolean
    flash_attn_type?: string
    flash_attn?: boolean
    cache_type_k?: string
    cache_type_v?: string
    use_mlock?: boolean
    use_mmap?: boolean
    vocab_only?: boolean
    no_extra_bufts?: boolean
    lora?: string
    lora_scaled?: number
    lora_list?: Array<{ path: string; scaled?: number }>
    rope_freq_base?: number
    rope_freq_scale?: number
    speculative?: NativeSpeculativeConfig
    spec_type?: NativeSpeculativeType | Array<NativeSpeculativeType>
    spec_draft_n_max?: number
    spec_draft_n_min?: number
    spec_draft_p_min?: number
    spec_draft_p_split?: number
    pooling_type?: number
    ctx_shift?: boolean
    kv_unified?: boolean
    swa_full?: boolean
    n_cpu_moe?: number
    embedding?: boolean
    embd_normalize?: number
  }

  export type ContextParams = Omit<NativeContextParams, 'flash_attn_type' | 'cache_type_k' | 'cache_type_v' | 'pooling_type'> & {
    flash_attn_type?: 'auto' | 'on' | 'off'
    cache_type_k?: 'f16' | 'f32' | 'q8_0' | 'q4_0' | 'q4_1' | 'iq4_nl' | 'q5_0' | 'q5_1'
    cache_type_v?: 'f16' | 'f32' | 'q8_0' | 'q4_0' | 'q4_1' | 'iq4_nl' | 'q5_0' | 'q5_1'
    pooling_type?: 'none' | 'mean' | 'cls' | 'last' | 'rank'
  }

  export type TokenData = {
    token: string
    completion_probabilities?: Array<NativeCompletionTokenProb>
    content?: string
    reasoning_content?: string
    tool_calls?: Array<ToolCall>
    accumulated_text?: string
    requestId?: number
  }

  export type ToolCall = {
    type: 'function'
    id?: string
    function: { name: string; arguments: string }
  }

  export type CompletionResponseFormat = {
    type: 'text' | 'json_object' | 'json_schema'
    json_schema?: { strict?: boolean; schema: object }
    schema?: object
  }

  export type CompletionBaseParams = {
    prompt?: string
    messages?: Array<{ role: string; content?: string | Array<{ type: string; text?: string; image_url?: { url?: string }; input_audio?: { format: string; data?: string; url?: string } }>; reasoning_content?: string }>
    chatTemplate?: string
    chat_template?: string
    jinja?: boolean
    tools?: object
    parallel_tool_calls?: object
    tool_choice?: string
    response_format?: CompletionResponseFormat
    media_paths?: string | string[]
    add_generation_prompt?: boolean
    now?: string | number
    chat_template_kwargs?: Record<string, string | number | boolean>
    force_pure_content?: boolean
    prefill_text?: string
  }

  export type CompletionParams = Omit<NativeCompletionParams, 'emit_partial_completion' | 'prompt'> & CompletionBaseParams

  export interface NativeCompletionParams {
    prompt: string
    n_threads?: number
    jinja?: boolean
    json_schema?: string
    grammar?: string
    grammar_lazy?: boolean
    grammar_triggers?: Array<{ type: number; value: string; token: number }>
    preserved_tokens?: Array<string>
    chat_format?: number
    reasoning_format?: 'none' | 'auto' | 'deepseek'
    media_paths?: Array<string>
    stop?: Array<string>
    n_predict?: number
    n_probs?: number
    speculative?: NativeSpeculativeConfig
    spec_type?: NativeSpeculativeType | Array<NativeSpeculativeType>
    spec_draft_n_max?: number
    spec_draft_n_min?: number
    spec_draft_p_min?: number
    spec_draft_p_split?: number
    top_k?: number
    top_p?: number
    min_p?: number
    xtc_probability?: number
    xtc_threshold?: number
    typical_p?: number
    temperature?: number
    penalty_last_n?: number
    penalty_repeat?: number
    penalty_freq?: number
    penalty_present?: number
    mirostat?: number
    mirostat_tau?: number
    mirostat_eta?: number
    dry_multiplier?: number
    dry_base?: number
    dry_allowed_length?: number
    dry_penalty_last_n?: number
    dry_sequence_breakers?: Array<string>
    top_n_sigma?: number
    ignore_eos?: boolean
    logit_bias?: Array<Array<number>>
    seed?: number
    guide_tokens?: Array<number>
    emit_partial_completion: boolean
  }

  export interface NativeCompletionResult {
    text: string
    reasoning_content: string
    tool_calls: Array<ToolCall>
    content: string
    chat_format: number
    tokens_predicted: number
    tokens_evaluated: number
    draft_tokens: number
    draft_tokens_accepted: number
    truncated: boolean
    stopped_eos: boolean
    stopped_word: string
    stopped_limit: number
    stopping_word: string
    context_full: boolean
    interrupted: boolean
    tokens_cached: number
    timings: NativeCompletionResultTimings
    completion_probabilities?: Array<NativeCompletionTokenProb>
    audio_tokens?: Array<number>
  }

  export type NativeCompletionTokenProbItem = { tok_str: string; prob: number }
  export type NativeCompletionTokenProb = { content: string; probs: Array<NativeCompletionTokenProbItem> }
  export type NativeCompletionResultTimings = {
    cache_n: number
    prompt_n: number
    prompt_ms: number
    prompt_per_token_ms: number
    prompt_per_second: number
    predicted_n: number
    predicted_ms: number
    predicted_per_token_ms: number
    predicted_per_second: number
  }

  export class LlamaContext {
    id: number
    gpu: boolean
    reasonNoGPU: string
    devices: Array<string>
    model: {
      desc: string
      size: number
      nEmbd: number
      nParams: number
      is_recurrent: boolean
      is_hybrid: boolean
      isChatTemplateSupported: boolean
      chatTemplates: { llamaChat: boolean; jinja: { default: boolean; defaultCaps: { tools: boolean; toolCalls: boolean; systemRole: boolean; parallelToolCalls: boolean }; toolUse: boolean }; metadata: object }
    }
    androidLib?: string
    systemInfo: string

    completion(params: CompletionParams, callback?: (data: TokenData) => void): Promise<NativeCompletionResult>
    stopCompletion(): Promise<void>
    release(): Promise<void>
    loadSession(filepath: string): Promise<{ tokens_loaded: number; prompt: string }>
    saveSession(filepath: string, options?: { tokenSize: number }): Promise<number>
    isLlamaChatSupported(): boolean
    isJinjaSupported(): boolean
    getFormattedChat(messages: Array<{ role: string; content?: string | Array<{ type: string; text?: string; image_url?: { url?: string } }> }>, template?: string | null, params?: { jinja?: boolean; response_format?: CompletionResponseFormat; tools?: object; tool_choice?: string; enable_thinking?: boolean; reasoning_format?: 'none' | 'auto' | 'deepseek'; add_generation_prompt?: boolean; now?: string | number; chat_template_kwargs?: Record<string, string | number | boolean>; force_pure_content?: boolean }): Promise<{ type: string; prompt: string; has_media: boolean; media_paths?: Array<string> }>
    tokenize(text: string, opts?: { media_paths?: string[] }): Promise<{ tokens: Array<number>; has_media: boolean; bitmap_hashes: Array<number>; chunk_pos: Array<number>; chunk_pos_media: Array<number> }>
    detokenize(tokens: number[]): Promise<string>
    clearCache(clearData?: boolean): Promise<void>
    bench(pp: number, tg: number, pl: number, nr: number): Promise<{ nKvMax: number; nBatch: number; nUBatch: number; flashAttn: number; isPpShared: number; nGpuLayers: number; nThreads: number; nThreadsBatch: number; pp: number; tg: number; pl: number; nKv: number; tPp: number; speedPp: number; tTg: number; speedTg: number; t: number; speed: number }>
  }

  export function initLlama(options: ContextParams, onProgress?: (progress: number) => void): Promise<LlamaContext>
  export function getDefaultModelPath(filename: string): string
  export function isNpuSupported(): boolean
  export function releaseAllLlama(): Promise<void>
  export function getBackendDevicesInfo(): Promise<Array<{ backend: string; type: string; deviceName: string; maxMemorySize: number; metadata?: Record<string, any> }>>
  export function loadLlamaModelInfo(model: string): Promise<object>
  export function setContextLimit(limit: number): Promise<void>
  export function toggleNativeLog(enabled: boolean): Promise<void>
  export function addNativeLogListener(listener: (level: string, text: string) => void): { remove: () => void }
}
