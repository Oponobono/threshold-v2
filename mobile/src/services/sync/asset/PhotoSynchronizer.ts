import { EntitySynchronizer } from '../EntitySynchronizer';
import { BaseRepository } from '../../database/BaseRepository';

export class PhotoSynchronizer implements EntitySynchronizer {
  readonly entityType = 'photos';
  private repo = new BaseRepository('photos');

  async saveAll(items: any[]): Promise<number> {
    if (items.length === 0) return 0;
    const prepared = items.map(item => ({
      ...item,
      asset_state: item.asset_state || 'NOT_DOWNLOADED',
    }));
    await this.repo.upsertMany(prepared);
    return prepared.length;
  }

  async deleteItem(id: string): Promise<void> {
    await this.repo.upsert({ id, deleted_at: new Date().toISOString() } as any);
  }
}
