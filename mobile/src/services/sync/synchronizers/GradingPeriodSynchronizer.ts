import { EntitySynchronizer } from '../EntitySynchronizer';
import { gradingPeriodRepository } from '../../database/repositories/GradingPeriodRepository';

export class GradingPeriodSynchronizer implements EntitySynchronizer {
  readonly entityType = 'grading_periods';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await gradingPeriodRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await gradingPeriodRepository.delete(id);
  }
}
