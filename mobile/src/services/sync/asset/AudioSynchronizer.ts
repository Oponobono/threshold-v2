import { EntitySynchronizer } from '../EntitySynchronizer';
import { BaseRepository } from '../../database/BaseRepository';

export class AudioSynchronizer implements EntitySynchronizer {
  readonly entityType = 'audio_recordings';
  private repo = new BaseRepository('audio_recordings');

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await this.repo.upsert({
        ...item,
        asset_state: item.asset_state || 'NOT_DOWNLOADED',
      });
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await this.repo.upsert({ id, deleted_at: new Date().toISOString() } as any);
  }
}
