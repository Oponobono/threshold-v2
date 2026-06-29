import { EntitySynchronizer } from '../EntitySynchronizer';

export class SubjectSynchronizer implements EntitySynchronizer {
  readonly entityType = 'subjects';

  async saveAll(items: any[]): Promise<number> {
    const { subjectRepository } = await import('../../database/repositories/SubjectRepository');
    let count = 0;
    for (const item of items) {
      await subjectRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { subjectRepository } = await import('../../database/repositories/SubjectRepository');
    await subjectRepository.delete(id);
  }
}
