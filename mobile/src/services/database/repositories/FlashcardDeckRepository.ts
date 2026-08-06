import { BaseRepository } from '../BaseRepository';

export interface FlashcardDeck {
  id: string;
  user_id: string;
  subject_id?: string;
  title: string;
  topic?: string | null;
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

  async findConflictingTitles(userId: string, baseTitle: string): Promise<string[]> {
    const db = this.getDb();
    // Escape LIKE special characters (%, _, \) to avoid wildcard misinterpretation
    const escaped = baseTitle.replace(/[\\%_]/g, '\\$&');
    const pattern = `${escaped}%`;
    const result = await db.getAllAsync<{ title: string }>(
      `SELECT title FROM ${this.tableName} WHERE user_id = ? AND deleted_at IS NULL AND title LIKE ? ESCAPE '\\'`,
      [userId, pattern]
    );
    return result.map(r => r.title);
  }
}

export const flashcardDeckRepository = new FlashcardDeckRepository();
