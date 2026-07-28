import { EntitySynchronizer } from '../EntitySynchronizer';
import { audioTranscriptRepository } from '../../database/repositories/AudioTranscriptRepository';

export class AudioTranscriptSynchronizer implements EntitySynchronizer {
  readonly entityType = 'audio_transcripts';

  async saveAll(items: any[]): Promise<number> {
    await audioTranscriptRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await audioTranscriptRepository.delete(id);
  }
}
