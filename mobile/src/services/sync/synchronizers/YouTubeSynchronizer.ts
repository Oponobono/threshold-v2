import { EntitySynchronizer } from '../EntitySynchronizer';
import { youTubeRepository } from '../../database/repositories/YouTubeRepository';

export class YouTubeSynchronizer implements EntitySynchronizer {
  readonly entityType = 'youtube_videos';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await youTubeRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await youTubeRepository.delete(id);
  }
}
