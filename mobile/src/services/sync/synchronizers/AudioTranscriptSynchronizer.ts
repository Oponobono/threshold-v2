import { EntitySynchronizer } from '../EntitySynchronizer';
import { audioTranscriptRepository } from '../../database/repositories/AudioTranscriptRepository';

export class AudioTranscriptSynchronizer implements EntitySynchronizer {
  readonly entityType = 'audio_transcripts';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await audioTranscriptRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await audioTranscriptRepository.delete(id);
  }
}
