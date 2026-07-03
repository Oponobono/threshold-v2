/**
 * Pure function to calculate elapsed days since the last review.
 * Abstracts away date parsing and math from the core algorithm.
 * 
 * @param lastReviewTimestamp ISO string, timestamp, or Date object. Null if never reviewed.
 * @param currentDate The current Date object representing "now". Defaults to new Date().
 * @returns Number of elapsed days. 0 if it's the first review.
 */
export function calculateElapsedDays(
  lastReviewTimestamp: string | number | Date | null | undefined,
  currentDate: Date = new Date()
): number {
  if (!lastReviewTimestamp) {
    return 0;
  }

  const lastReview = new Date(lastReviewTimestamp);
  
  // If parsing failed (Invalid Date), return 0 to be safe
  if (isNaN(lastReview.getTime())) {
    return 0;
  }

  const diffMs = currentDate.getTime() - lastReview.getTime();
  const elapsedDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  
  return elapsedDays;
}
