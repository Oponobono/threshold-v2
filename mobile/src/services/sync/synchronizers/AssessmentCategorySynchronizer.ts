import { EntitySynchronizer } from '../EntitySynchronizer';
import { assessmentCategoryRepository } from '../../database/repositories/AssessmentCategoryRepository';

export class AssessmentCategorySynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessment_categories';

  async saveAll(items: any[]): Promise<number> {
    await assessmentCategoryRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await assessmentCategoryRepository.delete(id);
  }
}
