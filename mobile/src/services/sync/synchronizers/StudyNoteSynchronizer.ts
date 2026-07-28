import { EntitySynchronizer } from '../EntitySynchronizer';
import { studyNoteRepository } from '../../database/repositories/StudyNoteRepository';

export class StudyNoteSynchronizer implements EntitySynchronizer {
  readonly entityType = 'study_notes';

  async saveAll(items: any[]): Promise<number> {
    await studyNoteRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await studyNoteRepository.delete(id);
  }
}
