import { AIProvider, AIRequest, AIResponse } from './providers/AIProvider';
import { CloudProvider } from './providers/CloudProvider';
import { LocalProvider } from './providers/LocalProvider';
import { aiExecutionPolicy, ExecutionContext } from './AIExecutionPolicy';
import { semanticCache } from './cache/SemanticCache';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import { useLocalAIStore } from '../../store/useLocalAIStore';

class AIOrchestrator {
  private _cloudProvider = new CloudProvider();
  private _localProvider = new LocalProvider();
  private _cacheInitialized = false;

  get cloudProvider(): AIProvider { return this._cloudProvider; }
  get localProvider(): AIProvider { return this._localProvider; }

  private _buildContext(): ExecutionContext {
    const connectivity = useConnectivityStore.getState();
    const localAI = useLocalAIStore.getState();

    return {
      isOnline: connectivity.isOnline,
      isSlow: connectivity.isSlow,
      isExpensive: connectivity.isExpensive,
      hasLocalModel: localAI.activeModelId !== null && !!localAI.downloadedModels[localAI.activeModelId],
      deviceTier: localAI.deviceTier || 'mid',
      availableRamGB: localAI.deviceAvailableRamGB,
    };
  }

  async execute(req: AIRequest): Promise<AIResponse> {
    if (!this._cacheInitialized) {
      await semanticCache.initialize();
      this._cacheInitialized = true;
    }

    const queryText = req.messages.map(m => m.content).join('\n');
    const cached = await semanticCache.get(queryText);
    if (cached) {
      return {
        content: cached,
        provider: 'cache',
        model: 'semantic',
        latencyMs: 0,
        cached: true,
      };
    }

    const ctx = this._buildContext();
    const decision = aiExecutionPolicy.resolve(ctx);

    const provider = decision.provider === 'cloud'
      ? this._cloudProvider
      : this._localProvider;

    try {
      const result = await provider.chat(req);
      if (result.content.length > 20) {
        await semanticCache.set(queryText, result.content, result.model);
      }
      return result;
    } catch (cloudErr: any) {
      if (decision.provider === 'cloud') {
        console.warn(`[AIOrchestrator] Cloud failed (${cloudErr.message}), trying local...`);
        const localAvailable = await this._localProvider.isAvailable();
        if (localAvailable) {
          const result = await this._localProvider.chat(req);
          if (result.content.length > 20) {
            await semanticCache.set(queryText, result.content, result.model);
          }
          return result;
        }
      }
      throw cloudErr;
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();
