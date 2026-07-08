import { EntitySynchronizer } from '../EntitySynchronizer';
import { assessmentRepository } from '../../database/repositories/AssessmentRepository';

export class AssessmentSynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessments';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await assessmentRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await assessmentRepository.delete(id);
  }
}
