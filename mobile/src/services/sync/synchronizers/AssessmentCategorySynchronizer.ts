import { EntitySynchronizer } from '../EntitySynchronizer';

export class AssessmentCategorySynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessment_categories';

  async saveAll(items: any[]): Promise<number> {
    const { assessmentCategoryRepository } = await import('../../database/repositories/AssessmentCategoryRepository');
    let count = 0;
    for (const item of items) {
      await assessmentCategoryRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { assessmentCategoryRepository } = await import('../../database/repositories/AssessmentCategoryRepository');
    await assessmentCategoryRepository.delete(id);
  }
}
