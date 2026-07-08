import { EntitySynchronizer } from '../EntitySynchronizer';
import { BaseRepository } from '../../database/BaseRepository';

export class DocumentSynchronizer implements EntitySynchronizer {
  readonly entityType = 'scanned_documents';
  private repo = new BaseRepository('scanned_documents');

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
