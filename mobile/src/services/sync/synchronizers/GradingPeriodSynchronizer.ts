import { EntitySynchronizer } from '../EntitySynchronizer';

export class GradingPeriodSynchronizer implements EntitySynchronizer {
  readonly entityType = 'grading_periods';

  async saveAll(items: any[]): Promise<number> {
    const { gradingPeriodRepository } = await import('../../database/repositories/GradingPeriodRepository');
    let count = 0;
    for (const item of items) {
      await gradingPeriodRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { gradingPeriodRepository } = await import('../../database/repositories/GradingPeriodRepository');
    await gradingPeriodRepository.delete(id);
  }
}
