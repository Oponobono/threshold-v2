export interface CachePolicyConfig {
  ttl: number;
  unit: 'minutes' | 'hours' | 'days' | 'infinity';
  backgroundRefresh?: boolean;
  staleWhileRevalidate?: boolean;
}

interface InternalConfig {
  ttlMs: number;
  backgroundRefresh: boolean;
  staleWhileRevalidate: boolean;
}

class CachePolicyManager {
  private _policies: Map<string, InternalConfig> = new Map();

  register(entity: string, config: CachePolicyConfig): void {
    const ttlMs = config.unit === 'infinity'
      ? Infinity
      : config.ttl * (config.unit === 'days' ? 86400000 : config.unit === 'hours' ? 3600000 : 60000);

    this._policies.set(entity, {
      ttlMs,
      backgroundRefresh: config.backgroundRefresh ?? false,
      staleWhileRevalidate: config.staleWhileRevalidate ?? false,
    });
  }

  registerMany(configs: Record<string, CachePolicyConfig>): void {
    for (const [entity, config] of Object.entries(configs)) {
      this.register(entity, config);
    }
  }

  getTTL(entity: string): number {
    return this._policies.get(entity)?.ttlMs ?? 0;
  }

  shouldBackgroundRefresh(entity: string): boolean {
    return this._policies.get(entity)?.backgroundRefresh ?? false;
  }

  supportsStaleWhileRevalidate(entity: string): boolean {
    return this._policies.get(entity)?.staleWhileRevalidate ?? false;
  }

  isExpired(entity: string, updatedAt: string | undefined | null): boolean {
    const ttl = this.getTTL(entity);
    if (ttl === Infinity) return false;
    if (ttl === 0) return true;
    if (!updatedAt) return true;
    const age = Date.now() - new Date(updatedAt).getTime();
    return age > ttl;
  }

  timeUntilExpiry(entity: string, updatedAt: string | undefined | null): number {
    const ttl = this.getTTL(entity);
    if (ttl === Infinity) return Infinity;
    if (ttl === 0 || !updatedAt) return 0;
    const age = Date.now() - new Date(updatedAt).getTime();
    return Math.max(0, ttl - age);
  }

  isCacheable(entity: string): boolean {
    return this._policies.has(entity);
  }
}

export const cachePolicy = new CachePolicyManager();

cachePolicy.registerMany({
  user: { ttl: 0, unit: 'infinity', backgroundRefresh: false, staleWhileRevalidate: false },
  courses: { ttl: 30, unit: 'days', backgroundRefresh: true, staleWhileRevalidate: true },
  subjects: { ttl: 30, unit: 'days', backgroundRefresh: true, staleWhileRevalidate: true },
  predictions: { ttl: 30, unit: 'minutes', backgroundRefresh: true, staleWhileRevalidate: true },
  schedules: { ttl: 5, unit: 'minutes', backgroundRefresh: true, staleWhileRevalidate: true },
  analytics: { ttl: 15, unit: 'minutes', backgroundRefresh: true, staleWhileRevalidate: true },
  assessments: { ttl: 1, unit: 'hours', backgroundRefresh: true, staleWhileRevalidate: true },
  flashcards: { ttl: 1, unit: 'hours', backgroundRefresh: true, staleWhileRevalidate: true },
  flashcard_decks: { ttl: 1, unit: 'hours', backgroundRefresh: true, staleWhileRevalidate: true },
  chat: { ttl: 0, unit: 'minutes', backgroundRefresh: false, staleWhileRevalidate: false },
  photos: { ttl: 7, unit: 'days', backgroundRefresh: false, staleWhileRevalidate: true },
  audio_recordings: { ttl: 7, unit: 'days', backgroundRefresh: false, staleWhileRevalidate: true },
  youtube_videos: { ttl: 7, unit: 'days', backgroundRefresh: false, staleWhileRevalidate: true },
  scanned_documents: { ttl: 7, unit: 'days', backgroundRefresh: false, staleWhileRevalidate: true },
  settings: { ttl: 0, unit: 'infinity', backgroundRefresh: false, staleWhileRevalidate: false },
});
