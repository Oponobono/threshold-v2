import type { Subject } from '../../services/api/types';
import type { ContinueTarget } from '../../types/heroViewModels';

interface RecommendationContext {
  readonly subjects: Subject[];
  readonly completedClasses: number;
}

export class RecommendationService {
  static build(context: RecommendationContext): ContinueTarget {
    const { subjects, completedClasses } = context;

    const bestSubject = subjects.length > 0
      ? subjects.reduce((prev, curr) =>
          (curr.completed_lessons ?? 0) <= (prev.completed_lessons ?? 0) ? curr : prev
        )
      : null;

    return {
      type: 'class',
      subjectId: bestSubject?.id ?? '',
      entityId: `class-${completedClasses + 1}`,
      label: `Clase ${completedClasses + 1}`,
    };
  }
}
