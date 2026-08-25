import { AIProvider, AIRequest, AIResponse } from './AIProvider';
import { runInference, isReady, loadModel } from '../../localInferenceService';
import { useLocalAIStore, type LocalModelId } from '../../../store/useLocalAIStore';
import { extractDirectives } from '../core/ResponseInterpreter';

type ModelFamily = 'llama3' | 'qwen' | 'phi3' | 'gemma2';

function getModelFamily(modelId: LocalModelId): ModelFamily {
  if (modelId === 'qwen_1_5b' || modelId === 'qwen_3b') return 'qwen';
  if (modelId === 'phi3_5') return 'phi3';
  if (modelId === 'gemma2_2b') return 'gemma2';
  return 'llama3';
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function buildPrompt(family: ModelFamily, messages: ChatMessage[]): string {
  switch (family) {
    case 'llama3': {
      let prompt = '<|begin_of_text|>';
      for (const msg of messages) {
        prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
      }
      prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';
      return prompt;
    }
    case 'qwen': {
      let prompt = '';
      for (const msg of messages) {
        const role = msg.role === 'assistant' ? 'assistant' : msg.role;
        prompt += `<|im_start|>${role}\n${msg.content}<|im_end|>\n`;
      }
      prompt += '<|im_start|>assistant\n';
      return prompt;
    }
    case 'phi3': {
      let prompt = '';
      for (const msg of messages) {
        if (msg.role === 'system') {
          prompt += `<|system|>\n${msg.content}<|end|>\n`;
        } else if (msg.role === 'user') {
          prompt += `<|user|>\n${msg.content}<|end|>\n`;
        } else {
          prompt += `<|assistant|>\n${msg.content}<|end|>\n`;
        }
      }
      prompt += '<|assistant|>\n';
      return prompt;
    }
    case 'gemma2': {
      let prompt = '<bos>';
      for (const msg of messages) {
        if (msg.role === 'system') {
          prompt += `<start_of_turn>user\n${msg.content}<end_of_turn>\n`;
        } else if (msg.role === 'user') {
          prompt += `<start_of_turn>user\n${msg.content}<end_of_turn>\n`;
        } else {
          prompt += `<start_of_turn>model\n${msg.content}<end_of_turn>\n`;
        }
      }
      prompt += '<start_of_turn>model\n';
      return prompt;
    }
  }
}

export class LocalProvider implements AIProvider {
  readonly name = 'local';

  async isAvailable(): Promise<boolean> {
    if (isReady()) return true;
    const store = useLocalAIStore.getState();
    return store.activeModelId !== null && !!store.downloadedModels[store.activeModelId];
  }

  async chat(req: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const store = useLocalAIStore.getState();
    const modelId = store.activeModelId;

    if (!modelId) {
      throw new Error('No local model selected');
    }

    if (!isReady()) {
      const modelPath = store.downloadedModels[modelId];
      if (!modelPath) throw new Error(`Model ${modelId} not downloaded`);
      await loadModel(modelId);
    }

    const family = getModelFamily(modelId as LocalModelId);
    const prompt = buildPrompt(family, req.messages);

    const streamCallbacks = req.onStreamToken
      ? { onToken: (token: string, accumulated: string, reasoning: string) => req.onStreamToken!(token, accumulated, reasoning) }
      : undefined;

    const result = await runInference({
      prompt,
      temperature: req.temperature ?? 0.7,
      maxTokens: req.maxTokens ?? 512,
    }, streamCallbacks);

    const latencyMs = Date.now() - startTime;
    const rawContent = result.text || '';
    const { cleanContent, directives } = extractDirectives(rawContent);

    return {
      content: cleanContent,
      provider: 'local',
      model: result.modelName || modelId,
      latencyMs,
      ...(directives.length > 0 && { directives }),
    };
  }
}
