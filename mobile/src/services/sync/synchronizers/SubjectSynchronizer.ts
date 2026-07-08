import { EntitySynchronizer } from '../EntitySynchronizer';
import { subjectRepository } from '../../database/repositories/SubjectRepository';

export class SubjectSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subjects';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await subjectRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await subjectRepository.delete(id);
  }
}
