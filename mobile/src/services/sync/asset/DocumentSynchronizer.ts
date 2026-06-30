import { EntitySynchronizer } from '../EntitySynchronizer';

export class DocumentSynchronizer implements EntitySynchronizer {
  readonly entityType = 'scanned_documents';

  async saveAll(items: any[]): Promise<number> {
    const { BaseRepository } = await import('../../database/BaseRepository');
    const repo = new BaseRepository('scanned_documents');
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
    const repo = new BaseRepository('scanned_documents');
    await repo.upsert({ id, deleted_at: new Date().toISOString() } as any);
  }
}
