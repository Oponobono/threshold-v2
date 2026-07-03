export type ReviewQuality = 1 | 2 | 3 | 4 | 5;

export interface ReviewInput {
  quality: ReviewQuality;
  stability: number;
  difficulty: number;
  repetitions: number;
  elapsedDays: number;
}

export interface ReviewDecision {
  oldStability: number;
  newStability: number;
  oldDifficulty: number;
  newDifficulty: number;
  intervalDays: number;
  retrievability: number;
  reviewOutcome: 'forgotten' | 'hard' | 'good' | 'perfect';
  newRepetitions: number;
}
