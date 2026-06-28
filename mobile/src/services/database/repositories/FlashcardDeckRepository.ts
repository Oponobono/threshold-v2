import { BaseRepository } from '../BaseRepository';

export interface FlashcardDeck {
  id: string;
  user_id: string;
  subject_id?: string;
  title: string;
  description?: string;
  card_count?: number;
  review_count?: number;
  learning_count?: number;
  new_count?: number;
  subject_name?: string;
  subject_color?: string;
  subject_icon?: string;
  owner_username?: string;
  owner_name?: string;
  linked_event_id?: string;
  avg_ease_factor?: number;
  total_reviews?: number;
  last_reviewed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class FlashcardDeckRepository extends BaseRepository<FlashcardDeck> {
  constructor() {
    super('flashcard_decks');
  }

  async getByUser(userId: string): Promise<FlashcardDeck[]> {
    return this.getByField('user_id', userId);
  }

  async getBySubject(subjectId: string): Promise<FlashcardDeck[]> {
    return this.getByField('subject_id', subjectId);
  }

  async getByLinkedEvent(eventId: string): Promise<FlashcardDeck[]> {
    return this.getByField('linked_event_id', eventId);
  }
}

export const flashcardDeckRepository = new FlashcardDeckRepository();
