export type ExecutionPolicy =
  | 'AUTO'
  | 'ONLINE_ONLY'
  | 'OFFLINE_ONLY'
  | 'CHEAPEST'
  | 'FASTEST'
  | 'BEST_QUALITY';

export interface PolicyDecision {
  provider: 'cloud' | 'local';
  reason: string;
}

export interface ExecutionContext {
  isOnline: boolean;
  isSlow: boolean;
  isExpensive: boolean;
  hasLocalModel: boolean;
  deviceTier: 'low' | 'mid' | 'high';
  availableRamGB: number;
}

class AIExecutionPolicyEngine {
  private _policy: ExecutionPolicy = 'AUTO';

  get policy(): ExecutionPolicy {
    return this._policy;
  }

  setPolicy(policy: ExecutionPolicy): void {
    this._policy = policy;
    console.log(`[AIExecutionPolicy] Policy set to ${policy}`);
  }

  resolve(ctx: ExecutionContext): PolicyDecision {
    switch (this._policy) {
      case 'ONLINE_ONLY':
        if (!ctx.isOnline) {
          return { provider: 'local', reason: 'ONLINE_ONLY but offline, falling back to local' };
        }
        return { provider: 'cloud', reason: 'ONLINE_ONLY policy' };

      case 'OFFLINE_ONLY':
        return { provider: 'local', reason: 'OFFLINE_ONLY policy' };

      case 'CHEAPEST':
        if (ctx.hasLocalModel) {
          return { provider: 'local', reason: 'CHEAPEST policy: local is free' };
        }
        return { provider: 'cloud', reason: 'CHEAPEST policy: no local model available' };

      case 'FASTEST':
        if (ctx.isOnline && !ctx.isSlow) {
          return { provider: 'cloud', reason: 'FASTEST policy: cloud is faster' };
        }
        if (ctx.hasLocalModel) {
          return { provider: 'local', reason: 'FASTEST policy: slow network, using local' };
        }
        return { provider: 'cloud', reason: 'FASTEST policy: no local model' };

      case 'BEST_QUALITY':
        if (ctx.isOnline) {
          return { provider: 'cloud', reason: 'BEST_QUALITY policy: cloud has larger models' };
        }
        if (ctx.hasLocalModel) {
          return { provider: 'local', reason: 'BEST_QUALITY policy: no network, using local' };
        }
        return { provider: 'cloud', reason: 'BEST_QUALITY policy: fallback to cloud' };

      case 'AUTO':
      default:
        if (ctx.isOnline && !ctx.isSlow) {
          return { provider: 'cloud', reason: 'AUTO: online, using cloud' };
        }
        if (ctx.hasLocalModel) {
          return { provider: 'local', reason: 'AUTO: no connection or slow, using local' };
        }
        if (ctx.isOnline) {
          return { provider: 'cloud', reason: 'AUTO: online despite slow, using cloud' };
        }
        return { provider: 'local', reason: 'AUTO: offline, no local model either' };
    }
  }
}

export const aiExecutionPolicy = new AIExecutionPolicyEngine();
