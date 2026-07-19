import type { Course, Subject } from '../../services/api/types';
import type { CourseHeroViewModel, KnowledgeSummary } from '../../types/heroViewModels';
import { RecommendationService } from '../../domain/recommendations/RecommendationService';

export interface CourseHeroInput {
  readonly course: Course;
  readonly subjects: Subject[];
  readonly primaryKnowledge?: KnowledgeSummary;
}

export class CourseHeroPresenter {
  build(input: CourseHeroInput): CourseHeroViewModel {
    const { course, subjects, primaryKnowledge } = input;
    const completed = course.completed_classes ?? 0;
    const total = course.total_classes ?? 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const recommendation = RecommendationService.build({
      subjects,
      completedClasses: completed,
    });

    return {
      title: course.name,
      instructor: course.instructor,
      platform: course.platform,
      tags: course.tags?.split(',').map(t => t.trim()),
      progress,
      completedClasses: completed,
      totalClasses: total,
      knowledge: primaryKnowledge,
      momentum: course.last_studied_at ? Math.round((course.momentum_score ?? 0) * 100) : 0,
      continueLabel: recommendation.label,
      contentType: recommendation.contentType,
      subjectCount: subjects.length,
      creditCount: subjects.reduce((sum, s) => sum + (s.credits ?? 0), 0),
      mainUrl: course.main_url,
      certificateUrl: course.certificate_url,
    };
  }
}
