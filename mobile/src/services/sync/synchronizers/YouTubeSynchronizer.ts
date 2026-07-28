import { EntitySynchronizer } from '../EntitySynchronizer';
import { youTubeRepository } from '../../database/repositories/YouTubeRepository';

export class YouTubeSynchronizer implements EntitySynchronizer {
  readonly entityType = 'youtube_videos';

  async saveAll(items: any[]): Promise<number> {
    await youTubeRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await youTubeRepository.delete(id);
  }
}
