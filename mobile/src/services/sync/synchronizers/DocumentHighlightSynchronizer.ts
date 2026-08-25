import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class DocumentHighlightSynchronizer implements EntitySynchronizer {
  readonly entityType = 'document_highlights';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.highlights().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.highlights().delete(id);
  }
}
