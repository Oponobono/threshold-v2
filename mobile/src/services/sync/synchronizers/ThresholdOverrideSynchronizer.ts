import { RepositoryFactory } from '../../database/RepositoryFactory';
import { EntitySynchronizer } from '../EntitySynchronizer';

export class ThresholdOverrideSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subject_threshold_overrides';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.thresholdOverrides().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.thresholdOverrides().delete(id);
  }
}
