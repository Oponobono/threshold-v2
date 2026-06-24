import { BaseRepository } from '../BaseRepository';
import type { CardDirection } from '../../api/types';

export interface Flashcard {
  id: string;
  deck_id: string;
  front: string;
  back?: string;
  status?: string;
  direction?: CardDirection;
  created_at?: string;
  updated_at?: string;
}

export class FlashcardRepository extends BaseRepository<Flashcard> {
  constructor() {
    super('flashcards');
  }

  async getByDeck(deckId: string): Promise<Flashcard[]> {
    return this.getByField('deck_id', deckId);
  }
}

export const flashcardRepository = new FlashcardRepository();
