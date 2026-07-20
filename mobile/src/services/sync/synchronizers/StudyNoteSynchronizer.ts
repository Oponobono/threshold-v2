import { EntitySynchronizer } from '../EntitySynchronizer';
import { studyNoteRepository } from '../../database/repositories/StudyNoteRepository';

export class StudyNoteSynchronizer implements EntitySynchronizer {
  readonly entityType = 'study_notes';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await studyNoteRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await studyNoteRepository.delete(id);
  }
}
