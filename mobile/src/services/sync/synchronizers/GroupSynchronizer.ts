import { RepositoryFactory } from '../../database/RepositoryFactory';
import { EntitySynchronizer } from '../EntitySynchronizer';

export class GroupSynchronizer implements EntitySynchronizer {
  readonly entityType = 'groups';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.groups().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.groups().delete(id);
  }
}
