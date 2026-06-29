import { cachePolicy } from './CachePolicy';

export type LoadStrategy = 'cache_or_wait' | 'cache_then_sync' | 'wait_for_sync';

export interface DataLoadResult<T> {
  data: T[];
  source: 'cache' | 'sync' | 'empty';
  stale: boolean;
}

class DataLoader {
  async load<T>(
    entity: string,
    fetchFromDb: () => Promise<T[]>,
    getUpdatedAt: (item: T) => string | undefined | null,
    strategy: LoadStrategy = 'cache_then_sync',
  ): Promise<DataLoadResult<T>> {
    const data = await fetchFromDb();
    const hasData = data.length > 0;

    if (!hasData) {
      if (strategy === 'wait_for_sync') {
        return { data: [], source: 'empty', stale: false };
      }
      return { data: [], source: 'empty', stale: false };
    }

    const isCacheable = cachePolicy.isCacheable(entity);
    if (!isCacheable) {
      return { data, source: 'cache', stale: false };
    }

    const allExpired = data.every(item => {
      const updatedAt = getUpdatedAt(item);
      return cachePolicy.isExpired(entity, updatedAt);
    });

    const stale = allExpired;

    if (strategy === 'cache_or_wait') {
      return { data, source: 'cache', stale };
    }

    if (stale && cachePolicy.supportsStaleWhileRevalidate(entity)) {
      return { data, source: 'cache', stale: true };
    }

    if (stale && strategy === 'wait_for_sync') {
      return { data: [], source: 'empty', stale: false };
    }

    return { data, source: 'cache', stale };
  }

  async loadAndRefresh<T>(
    entity: string,
    fetchFromDb: () => Promise<T[]>,
    getUpdatedAt: (item: T) => string | undefined | null,
    triggerSync: () => Promise<void>,
  ): Promise<DataLoadResult<T>> {
    const result = await this.load(entity, fetchFromDb, getUpdatedAt, 'cache_then_sync');

    if (cachePolicy.shouldBackgroundRefresh(entity) && result.stale) {
      triggerSync().catch(() => {});
    }

    return result;
  }
}

export const dataLoader = new DataLoader();
