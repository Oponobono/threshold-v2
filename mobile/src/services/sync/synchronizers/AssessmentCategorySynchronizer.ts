import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class AssessmentCategorySynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessment_categories';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.assessmentCategories().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.assessmentCategories().delete(id);
  }
}
