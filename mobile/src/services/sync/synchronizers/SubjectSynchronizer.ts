import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class SubjectSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subjects';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.subjects().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.subjects().delete(id);
  }
}
