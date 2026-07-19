export function calculateDaysLeft(dateStr: string): number {
  try {
    const [d, m, y] = dateStr.split('-').map(Number);
    const due = new Date(y, m - 1, d);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

export function formatExamCountdown(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}d vencido`;
  if (daysLeft === 0) return '¡Hoy!';
  if (daysLeft === 1) return 'Mañana';
  return `${daysLeft}d`;
}
