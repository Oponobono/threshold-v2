import { EntitySynchronizer } from '../EntitySynchronizer';

export class StudySessionSynchronizer implements EntitySynchronizer {
  readonly entityType = 'study_sessions';

  async saveAll(items: any[]): Promise<number> {
    const { studySessionRepository } = await import('../../database/repositories/StudySessionRepository');
    let count = 0;
    for (const item of items) {
      await studySessionRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { studySessionRepository } = await import('../../database/repositories/StudySessionRepository');
    await studySessionRepository.delete(id);
  }
}
