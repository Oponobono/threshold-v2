import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import type { CardDirection } from '../../api/types';

export interface Flashcard {
  id: string;
  deck_id: string;
  front: string;
  back?: string;
  status?: string;
  direction?: CardDirection;
  item_type?: string;
  content_json?: string;
  hint?: string | null;
  explanation?: string | null;
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
  next_review_date?: string;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  source_context?: string;
  created_at?: string;
  updated_at?: string;
}

export class FlashcardRepository extends SessionBoundRepository<Flashcard> {
  constructor(context: SessionBoundContext) {
    super('flashcards', context);
  }

  // Flashcards are owned indirectly via deck → user_id
  protected buildOwnershipWhereClause(): string {
    return 'EXISTS (SELECT 1 FROM flashcard_decks WHERE flashcard_decks.id = flashcards.deck_id AND flashcard_decks.user_id = ?)';
  }

  protected async enforceCreateOwnership(data: Partial<Flashcard>): Promise<void> {
    if (!data.deck_id) throw new Error('ILLEGAL_CREATE: deck_id is required');
    const db = this.getDb();
    if (!db) return;
    const row = await db.getFirstAsync<{user_id: string}>(
      'SELECT user_id FROM flashcard_decks WHERE id = ?', [data.deck_id]
    );
    if (!row || row.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: deck_id does not belong to current user');
  }
}

// export const flashcardRepository = new FlashcardRepository();
