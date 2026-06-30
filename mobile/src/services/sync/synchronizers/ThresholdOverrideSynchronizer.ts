import { EntitySynchronizer } from '../EntitySynchronizer';

export class ThresholdOverrideSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subject_threshold_overrides';

  async saveAll(items: any[]): Promise<number> {
    const { thresholdOverrideRepository } = await import('../../database/repositories/ThresholdOverrideRepository');
    let count = 0;
    for (const item of items) {
      await thresholdOverrideRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { thresholdOverrideRepository } = await import('../../database/repositories/ThresholdOverrideRepository');
    await thresholdOverrideRepository.delete(id);
  }
}
