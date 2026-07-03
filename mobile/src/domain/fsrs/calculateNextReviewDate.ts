import { ReviewDecision } from './types';

/**
 * Pure helper to calculate the next review date from an interval.
 * Separates date math from the pure FSRS algorithm.
 *
 * @param intervalDays Number of days until next review, from ReviewDecision.
 * @param referenceDate The "now" moment. Defaults to new Date(). Injected for testability.
 * @returns ISO 8601 string for the next review date.
 */
export function calculateNextReviewDate(
  intervalDays: ReviewDecision['intervalDays'],
  referenceDate: Date = new Date()
): string {
  const next = new Date(referenceDate.getTime());
  next.setDate(next.getDate() + intervalDays);
  return next.toISOString();
}
