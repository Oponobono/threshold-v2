import { EntitySynchronizer } from '../EntitySynchronizer';

export class AssessmentSynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessments';

  async saveAll(items: any[]): Promise<number> {
    const { assessmentRepository } = await import('../../database/repositories/AssessmentRepository');
    let count = 0;
    for (const item of items) {
      await assessmentRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { assessmentRepository } = await import('../../database/repositories/AssessmentRepository');
    await assessmentRepository.delete(id);
  }
}
