import { EntitySynchronizer } from '../EntitySynchronizer';
import { subjectRepository } from '../../database/repositories/SubjectRepository';

export class SubjectSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subjects';

  async saveAll(items: any[]): Promise<number> {
    await subjectRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await subjectRepository.delete(id);
  }
}
