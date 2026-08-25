import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class StudySessionSynchronizer implements EntitySynchronizer {
  readonly entityType = 'study_sessions';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.studySessions().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.studySessions().delete(id);
  }
}
