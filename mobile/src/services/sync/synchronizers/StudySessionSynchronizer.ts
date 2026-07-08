import { EntitySynchronizer } from '../EntitySynchronizer';
import { studySessionRepository } from '../../database/repositories/StudySessionRepository';

export class StudySessionSynchronizer implements EntitySynchronizer {
  readonly entityType = 'study_sessions';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await studySessionRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await studySessionRepository.delete(id);
  }
}
