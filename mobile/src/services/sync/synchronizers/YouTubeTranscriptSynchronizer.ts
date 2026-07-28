import { EntitySynchronizer } from '../EntitySynchronizer';
import { youTubeTranscriptRepository } from '../../database/repositories/YouTubeTranscriptRepository';

export class YouTubeTranscriptSynchronizer implements EntitySynchronizer {
  readonly entityType = 'youtube_transcripts';

  async saveAll(items: any[]): Promise<number> {
    await youTubeTranscriptRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await youTubeTranscriptRepository.delete(id);
  }
}
