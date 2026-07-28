import { EntitySynchronizer } from '../EntitySynchronizer';
import { studySessionRepository } from '../../database/repositories/StudySessionRepository';

export class StudySessionSynchronizer implements EntitySynchronizer {
  readonly entityType = 'study_sessions';

  async saveAll(items: any[]): Promise<number> {
    await studySessionRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await studySessionRepository.delete(id);
  }
}
