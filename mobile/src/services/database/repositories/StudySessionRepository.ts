import { BaseRepository } from '../BaseRepository';
import type { StudySession } from '../../api/types';

export type { StudySession };

export class StudySessionRepository extends BaseRepository<StudySession> {
  constructor() {
    super('study_sessions');
  }

  async getByUser(userId: string): Promise<StudySession[]> {
    return this.getByField('user_id', userId);
  }

  async getByDeck(deckId: string): Promise<StudySession[]> {
    return this.getByField('deck_id', deckId);
  }
}

export const studySessionRepository = new StudySessionRepository();
