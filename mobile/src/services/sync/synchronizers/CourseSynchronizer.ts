import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class CourseSynchronizer implements EntitySynchronizer {
  readonly entityType = 'courses';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.courses().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.courses().delete(id);
  }
}
