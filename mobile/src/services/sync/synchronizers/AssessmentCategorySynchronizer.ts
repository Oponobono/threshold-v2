import { EntitySynchronizer } from '../EntitySynchronizer';
import { assessmentCategoryRepository } from '../../database/repositories/AssessmentCategoryRepository';

export class AssessmentCategorySynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessment_categories';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await assessmentCategoryRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await assessmentCategoryRepository.delete(id);
  }
}
