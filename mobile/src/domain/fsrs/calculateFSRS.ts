import { ReviewInput, ReviewDecision } from './types';

/**
 * Pure function to calculate the Free Spaced Repetition Scheduler (FSRS) outcome.
 * It receives mathematical inputs and returns mathematical outputs without any side effects.
 */
export function calculateFSRS(input: ReviewInput): ReviewDecision {
  const { quality, stability, difficulty, repetitions, elapsedDays } = input;

  // Safe minimums
  const safeStability = Math.max(0.1, stability);
  
  // Calculate current retrievability based on elapsed days and stability
  const retrievability = Math.exp(-elapsedDays / (9 * safeStability));

  // Determine new difficulty
  const newDifficultyRaw = difficulty + 0.1 - quality * 0.02;
  const newDifficulty = Math.max(0.1, Math.min(10, newDifficultyRaw));

  let newStability: number;
  let newRepetitions = repetitions;
  let reviewOutcome: ReviewDecision['reviewOutcome'] = 'good';

  // Adjust stability based on quality
  if (quality < 3) {
    newStability = stability * 0.72;
    newRepetitions = 0; // Reset consecutive repetitions on failure
    reviewOutcome = 'forgotten';
  } else if (quality === 3) {
    newStability = stability * 1.26;
    newRepetitions += 1;
    reviewOutcome = 'hard';
  } else if (quality === 4) {
    newStability = stability * 1.77;
    newRepetitions += 1;
    reviewOutcome = 'good';
  } else {
    // quality === 5
    newStability = stability * 2.36;
    newRepetitions += 1;
    reviewOutcome = 'perfect';
  }

  // FSRS Explicit interval calculation based on target retention
  const TARGET_RETENTION = 0.90;
  const intervalDays = Math.max(1, Math.round(-9 * newStability * Math.log(TARGET_RETENTION)));

  return {
    oldStability: stability,
    newStability: Math.round(newStability * 100) / 100,
    oldDifficulty: difficulty,
    newDifficulty: Math.round(newDifficulty * 100) / 100,
    intervalDays,
    retrievability: Math.round(retrievability * 100),
    reviewOutcome,
    newRepetitions,
  };
}
