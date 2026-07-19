import { calculateElapsedDays } from './calculateElapsedDays';
import { calculateFSRS } from './calculateFSRS';
import { getActiveReviewPolicy } from './ReviewSchedulingPolicy';
import { ReviewInput, ReviewQuality } from './types';
import { flashcardRepository, syncService, cardLogRepository } from '../../services/database';
import { getUserId } from '../../services/api/auth/session';
import { uuidv4 } from '../../utils/uuid';

export interface CardForReview {
  id: string;
  deck_id: string;
  front?: string;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  fsrs_repetitions?: number;
  last_review_timestamp?: string | null;
  success_count?: number;
  failure_count?: number;
  view_count?: number;
  [key: string]: any;
}

export class FlashcardDomainService {
  /**
   * Main entry point for recording a flashcard review in a Local-First architecture.
   *
   * 1. Calculates elapsed days.
   * 2. Executes pure FSRS math.
   * 3. Calculates the new nextReviewDate.
   * 4. Updates SQLite.
   * 5. Enqueues Sync for the flashcard update.
   * 6. Records the card log in SQLite & Sync queue.
   */
  static async recordReview(
    card: CardForReview,
    isCorrect: boolean,
    responseTimeMs: number
  ): Promise<void> {
    const userId = await getUserId();
    if (!userId) {
      console.warn('[FlashcardDomainService] No user ID, cannot record review');
      return;
    }

    let quality: ReviewQuality = 1;
    if (isCorrect) {
      if (responseTimeMs < 3000) quality = 5;
      else if (responseTimeMs < 8000) quality = 4;
      else quality = 3;
    }

    const now = new Date();
    const elapsedDays = calculateElapsedDays(card.last_review_timestamp, now);

    const input: ReviewInput = {
      quality,
      stability: card.fsrs_stability || 1,
      difficulty: card.fsrs_difficulty || 0.5,
      repetitions: card.fsrs_repetitions || 0,
      elapsedDays,
    };

    const decision = calculateFSRS(input);

    // Policy converts intervalDays → concrete Date. FSRS stays pure.
    const policy = getActiveReviewPolicy();
    const nextReviewISO = policy.intervalToNextReview(decision.intervalDays, input.repetitions, now).toISOString();
    const nowISO = now.toISOString();

    // BaseRepository filters unknown columns via PRAGMA table_info at runtime
    const updatedFields: Record<string, any> = {
      fsrs_stability: decision.newStability,
      fsrs_difficulty: decision.newDifficulty,
      fsrs_repetitions: decision.newRepetitions,
      next_review_date: nextReviewISO,
      last_review_timestamp: nowISO,
      status: decision.reviewOutcome === 'forgotten' ? 'learning' : 'review',
      success_count: (card.success_count || 0) + (isCorrect ? 1 : 0),
      failure_count: (card.failure_count || 0) + (isCorrect ? 0 : 1),
      view_count: (card.view_count || 0) + 1,
    };

    await flashcardRepository.update(String(card.id), updatedFields as any);
    await syncService.enqueueUpdate('flashcard', String(card.id), updatedFields);

    const logId = uuidv4();
    const wordCount = (card.front || '').trim().split(/\s+/).filter(Boolean).length || 20;

    const logData: Record<string, any> = {
      id: logId,
      card_id: String(card.id),
      user_id: userId,
      result: isCorrect ? 'correct' : 'incorrect',
      response_time_ms: responseTimeMs,
      difficulty_deduced: decision.reviewOutcome,
      normalized_time_ms: responseTimeMs,
      text_length_words: wordCount,
    };

    await cardLogRepository.create(logData as any);
    await syncService.enqueueCreate('card-log', logId, logData);

    if (card.deck_id) {
      try {
        const { databaseService } = await import('../../services/database/DatabaseService');
        const { repositoryEventBus } = await import('../../services/events/RepositoryEventBus');
        await databaseService.getDb().runAsync(
          `UPDATE flashcard_decks SET last_reviewed_at = datetime('now') WHERE id = ?`,
          [String(card.deck_id)]
        );
        repositoryEventBus.emit({
          entityType: 'flashcard_decks',
          eventType: 'updated',
          entityId: String(card.deck_id),
          timestamp: Date.now(),
          priority: 'NORMAL',
        });
      } catch (e) {
        console.warn('[FlashcardDomainService] Error updating deck last_reviewed_at:', e);
      }
    }

    console.log(`[ReviewCompleted]
Card: ${String(card.id).substring(0, 8)}...
Quality: ${quality}
Previous Stability: ${card.fsrs_stability || 1}
New Stability: ${decision.newStability}
Interval Days (FSRS): ${decision.intervalDays}
Policy: ${policy.constructor.name}
Scheduled: ${nextReviewISO}`);
  }
}
