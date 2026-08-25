import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class StudyNoteSynchronizer implements EntitySynchronizer {
  readonly entityType = 'study_notes';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.studyNotes().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.studyNotes().delete(id);
  }
}
