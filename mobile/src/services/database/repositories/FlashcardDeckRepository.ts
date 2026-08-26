import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

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

export class FlashcardDeckRepository extends SessionBoundRepository<FlashcardDeck> {
  constructor(context: SessionBoundContext) {
    super('flashcard_decks', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<FlashcardDeck>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }

  async findConflictingTitles(baseTitle: string): Promise<string[]> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return [];
    const escaped = baseTitle.replace(/[\\%_]/g, '\\$&');
    const pattern = `${escaped}%`;
    const result = await db.getAllAsync<{ title: string }>(
      `SELECT title FROM ${this.tableName} WHERE user_id = ? AND deleted_at IS NULL AND title LIKE ? ESCAPE '\\'`,
      [this.context.userId, pattern]
    );
    return result.map(r => r.title);
  }

  async getDueCardCounts(): Promise<Map<string, number>> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return new Map();
    const now = new Date().toISOString();
    const rows = await db.getAllAsync<{ deck_id: string; due_count: number }>(
      `SELECT fc.deck_id, COUNT(*) as due_count
       FROM flashcards fc
       JOIN flashcard_decks fd ON fc.deck_id = fd.id
       WHERE fd.user_id = ?
       AND fc.deleted_at IS NULL
       AND fd.deleted_at IS NULL
       AND IFNULL(fc.status, '') NOT IN ('mastered', 'archived')
       AND fc.next_review_date IS NOT NULL
       AND fc.next_review_date <= ?
       GROUP BY fc.deck_id`,
      [this.context.userId, now]
    );
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(String(row.deck_id), row.due_count);
    }
    return map;
  }
}

// export const flashcardDeckRepository = new FlashcardDeckRepository();
