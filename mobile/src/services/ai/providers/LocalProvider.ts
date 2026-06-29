import { AIProvider, AIRequest, AIResponse } from './AIProvider';
import { runInference, isReady, loadModel } from '../../localInferenceService';
import { useLocalAIStore } from '../../../store/useLocalAIStore';

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
      await loadModel(modelPath);
    }

    const systemMsg = req.messages.find(m => m.role === 'system');
    const userMessages = req.messages.filter(m => m.role !== 'system');
    const conversationText = userMessages.map(m =>
      `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
    ).join('\n');

    const prompt = systemMsg
      ? `${systemMsg.content}\n\n${conversationText}\nAsistente:`
      : `${conversationText}\nAsistente:`;

    const streamCallbacks = req.onStreamToken
      ? { onToken: (token: string, accumulated: string, reasoning: string) => req.onStreamToken!(token) }
      : undefined;

    const result = await runInference({
      prompt,
      temperature: req.temperature ?? 0.7,
      maxTokens: req.maxTokens ?? 512,
    }, streamCallbacks);

    const latencyMs = Date.now() - startTime;
    const modelLabel = Object.entries(useLocalAIStore.getState().downloadedModels)
      .find(([, v]) => v === modelId)?.[0] || modelId;

    return {
      content: result.text || '',
      provider: 'local',
      model: modelLabel,
      latencyMs,
    };
  }
}
