import { EntitySynchronizer } from '../EntitySynchronizer';

export class AudioSynchronizer implements EntitySynchronizer {
  readonly entityType = 'audio_recordings';

  async saveAll(items: any[]): Promise<number> {
    const { BaseRepository } = await import('../../database/BaseRepository');
    const repo = new BaseRepository('audio_recordings');
    let count = 0;
    for (const item of items) {
      await repo.upsert({
        ...item,
        asset_state: item.asset_state || 'NOT_DOWNLOADED',
      });
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { BaseRepository } = await import('../../database/BaseRepository');
    const repo = new BaseRepository('audio_recordings');
    await repo.upsert({ id, deleted_at: new Date().toISOString() } as any);
  }
}
