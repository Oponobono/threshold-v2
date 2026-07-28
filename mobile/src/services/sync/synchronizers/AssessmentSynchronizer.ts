import { EntitySynchronizer } from '../EntitySynchronizer';
import { assessmentRepository } from '../../database/repositories/AssessmentRepository';

export class AssessmentSynchronizer implements EntitySynchronizer {
  readonly entityType = 'assessments';

  async saveAll(items: any[]): Promise<number> {
    await assessmentRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await assessmentRepository.delete(id);
  }
}
