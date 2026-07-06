export function calculateRetrievability(stability: number, elapsedDays: number): number {
  const safeStability = Math.max(0.1, stability);
  return Math.exp(-elapsedDays / (9 * safeStability));
}
