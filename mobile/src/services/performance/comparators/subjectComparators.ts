export function subjectCardComparator(
  prev: { id: string; name: string; averageGrade: number; pendingCards: number; courseId: string },
  next: { id: string; name: string; averageGrade: number; pendingCards: number; courseId: string }
): boolean {
  return (
    prev.id === next.id &&
    prev.name === next.name &&
    prev.averageGrade === next.averageGrade &&
    prev.pendingCards === next.pendingCards &&
    prev.courseId === next.courseId
  );
}

export function subjectListComparator(
  prev: Array<{ id: string; averageGrade: number; pendingCards: number }>,
  next: Array<{ id: string; averageGrade: number; pendingCards: number }>
): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((p, i) =>
    p.id === next[i].id &&
    p.averageGrade === next[i].averageGrade &&
    p.pendingCards === next[i].pendingCards
  );
}
