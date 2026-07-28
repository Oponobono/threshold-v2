import { EntitySynchronizer } from '../EntitySynchronizer';
import { thresholdOverrideRepository } from '../../database/repositories/ThresholdOverrideRepository';

export class ThresholdOverrideSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subject_threshold_overrides';

  async saveAll(items: any[]): Promise<number> {
    await thresholdOverrideRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await thresholdOverrideRepository.delete(id);
  }
}
