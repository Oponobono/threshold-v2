import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class AudioTranscriptSynchronizer implements EntitySynchronizer {
  readonly entityType = 'audio_transcripts';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.audioTranscripts().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.audioTranscripts().delete(id);
  }
}
