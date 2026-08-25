import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class AssessmentSynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessments';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.assessments().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.assessments().delete(id);
  }
}
