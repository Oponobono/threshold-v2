import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class YouTubeSynchronizer implements EntitySynchronizer {
  readonly entityType = 'youtube_videos';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.youtube().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.youtube().delete(id);
  }
}
