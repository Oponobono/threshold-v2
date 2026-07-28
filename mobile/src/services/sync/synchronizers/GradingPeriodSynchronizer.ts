import { EntitySynchronizer } from '../EntitySynchronizer';
import { gradingPeriodRepository } from '../../database/repositories/GradingPeriodRepository';

export class GradingPeriodSynchronizer implements EntitySynchronizer {
  readonly entityType = 'grading_periods';

  async saveAll(items: any[]): Promise<number> {
    await gradingPeriodRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await gradingPeriodRepository.delete(id);
  }
}
