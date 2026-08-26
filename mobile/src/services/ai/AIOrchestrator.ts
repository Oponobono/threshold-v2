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

    // Respetar selección explícita del usuario: 'local' → LocalProvider,
    // 'groq'/'gemini' → CloudProvider. Solo usar AIExecutionPolicy cuando
    // no hay preferencia explícita (req.provider undefined/null).
    const explicitProvider = req.provider === 'local'
      ? this._localProvider
      : req.provider === 'groq' || req.provider === 'gemini'
        ? this._cloudProvider
        : undefined;

    const provider = explicitProvider ?? (
      decision.provider === 'cloud'
        ? this._cloudProvider
        : this._localProvider
    );

    try {
      const result = await provider.chat(req);
      if (result.content.length > 20) {
        await semanticCache.set(queryText, result.content, result.model);
      }
      return result;
    } catch (primaryErr: any) {
      // Solo intentar fallback si la selección fue automática (sin preferencia explícita)
      if (!explicitProvider) {
        const fallback = provider === this._cloudProvider
          ? this._localProvider
          : this._cloudProvider;
        console.warn(`[AIOrchestrator] ${provider.name} failed (${primaryErr.message}), trying ${fallback.name}...`);
        const fallbackAvailable = await fallback.isAvailable();
        if (fallbackAvailable) {
          const result = await fallback.chat(req);
          if (result.content.length > 20) {
            await semanticCache.set(queryText, result.content, result.model);
          }
          return result;
        }
      }
      throw primaryErr;
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();
