import { EntitySynchronizer } from '../EntitySynchronizer';
import { thresholdOverrideRepository } from '../../database/repositories/ThresholdOverrideRepository';

export class ThresholdOverrideSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subject_threshold_overrides';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await thresholdOverrideRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await thresholdOverrideRepository.delete(id);
  }
}
