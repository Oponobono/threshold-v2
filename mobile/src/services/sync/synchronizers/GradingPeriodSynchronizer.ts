import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class GradingPeriodSynchronizer implements EntitySynchronizer {
  readonly entityType = 'grading_periods';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.gradingPeriods().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.gradingPeriods().delete(id);
  }
}
