/**
 * ReviewSchedulingPolicy
 *
 * Separates the "when should the user review?" question from the FSRS math.
 * FSRS produces intervalDays. The policy converts that into a concrete Date.
 *
 * Three modes:
 *  - production   → Use FSRS interval directly (days).
 *  - development  → Compress intervals to minutes for rapid QA.
 *  - accelerated  → Same as development; for post-launch internal testing.
 */

export interface ReviewSchedulingPolicy {
  intervalToNextReview(intervalDays: number, repetitions: number, now: Date): Date;
}

// Minutes per repetition index for non-production modes.
const COMPRESSED_SCHEDULE_MINUTES = [
  5,   // 1st review  → 5 minutes
  10,  // 2nd review  → 10 minutes
  30,  // 3rd review  → 30 minutes
  60,  // 4th review  → 1 hour
  120, // 5th review  → 2 hours
];

export class ProductionReviewPolicy implements ReviewSchedulingPolicy {
  intervalToNextReview(intervalDays: number, _repetitions: number, now: Date): Date {
    const next = new Date(now.getTime());
    next.setDate(next.getDate() + intervalDays);
    return next;
  }
}

export class AcceleratedReviewPolicy implements ReviewSchedulingPolicy {
  intervalToNextReview(intervalDays: number, repetitions: number, now: Date): Date {
    const minutes = COMPRESSED_SCHEDULE_MINUTES[repetitions];
    if (minutes != null) {
      return new Date(now.getTime() + minutes * 60 * 1000);
    }
    // After the compressed schedule is exhausted, fall back to real FSRS intervals.
    const next = new Date(now.getTime());
    next.setDate(next.getDate() + intervalDays);
    return next;
  }
}

// ─── Active policy ────────────────────────────────────────────────────────────
// Switch between 'production' | 'development' | 'accelerated'.
// 'development' and 'accelerated' map to AcceleratedReviewPolicy.
// Change this value to instantly switch modes without touching FSRS.
export type SchedulingMode = 'production' | 'development' | 'accelerated';

export const SCHEDULING_MODE: SchedulingMode = 'development';

export function getActiveReviewPolicy(): ReviewSchedulingPolicy {
  if (SCHEDULING_MODE === 'production') {
    return new ProductionReviewPolicy();
  }
  return new AcceleratedReviewPolicy();
}

console.log(`[ReviewPolicy]
Mode: ${SCHEDULING_MODE}
Policy: ${getActiveReviewPolicy().constructor.name} v1
Schedule: ${(SCHEDULING_MODE as SchedulingMode) === 'production' ? 'Real FSRS' : JSON.stringify(COMPRESSED_SCHEDULE_MINUTES)}`);
