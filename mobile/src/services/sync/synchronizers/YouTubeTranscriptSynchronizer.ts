import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class YouTubeTranscriptSynchronizer implements EntitySynchronizer {
  readonly entityType = 'youtube_transcripts';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.youtubeTranscripts().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.youtubeTranscripts().delete(id);
  }
}
