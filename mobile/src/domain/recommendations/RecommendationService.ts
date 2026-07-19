import type { Subject } from '../../services/api/types';
import type { ContentType } from '../../types/content';

interface Recommendation {
  readonly label: string;
  readonly contentType: ContentType;
}

interface RecommendationContext {
  readonly subjects: Subject[];
  readonly completedClasses: number;
}

export class RecommendationService {
  static build(context: RecommendationContext): Recommendation {
    const { completedClasses } = context;
    return {
      label: `Clase ${completedClasses + 1}`,
      contentType: 'class',
    };
  }
}
