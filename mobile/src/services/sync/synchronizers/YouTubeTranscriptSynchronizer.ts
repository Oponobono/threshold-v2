import { EntitySynchronizer } from '../EntitySynchronizer';
import { youTubeTranscriptRepository } from '../../database/repositories/YouTubeTranscriptRepository';

export class YouTubeTranscriptSynchronizer implements EntitySynchronizer {
  readonly entityType = 'youtube_transcripts';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await youTubeTranscriptRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await youTubeTranscriptRepository.delete(id);
  }
}
