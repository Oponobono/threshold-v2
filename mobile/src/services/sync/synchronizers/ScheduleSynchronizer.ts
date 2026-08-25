import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class ScheduleSynchronizer implements EntitySynchronizer {
  readonly entityType = 'schedules';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.schedules().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.schedules().delete(id);
  }
}
