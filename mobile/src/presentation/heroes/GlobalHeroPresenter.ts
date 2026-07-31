import type { Subject, Course, Assessment } from '../../services/api/types';
import type { GlobalHeroViewModel } from '../../types/heroViewModels';
import type { ContentType } from '../../types/content';
import { HealthScoringService } from '../../domain/knowledge/HealthScoringService';
import { formatRelativeTime } from '../../utils/relativeTime';
import { calculateDaysLeft } from '../../utils/date';
import { AcademicInsightGenerator } from './AcademicInsightGenerator';

export interface GlobalHeroInput {
  readonly subjects: Subject[];
  readonly courses: Course[];
  readonly assessments?: Assessment[];
  readonly healthScore?: number;
}

export class GlobalHeroPresenter {
  build(input: GlobalHeroInput): GlobalHeroViewModel {
    const { subjects, courses, assessments, healthScore } = input;

    const health = healthScore ?? HealthScoringService.calculateFromSubjects(subjects);

    let totalClasses = 0;
    let completedClasses = 0;
    courses.forEach(c => {
      totalClasses += c.total_classes || 0;
      completedClasses += c.completed_classes || 0;
    });
    const percentage = totalClasses > 0 ? Math.min(Math.round((completedClasses / totalClasses) * 100), 100) : 0;
    
    // Delegate insight generation to our dedicated component
    const insights = AcademicInsightGenerator.getTopInsights({ subjects, courses, assessments }, 2);

    const recommendation = subjects[0] ? {
      subjectName: subjects[0].name,
      action: 'Continuar',
      detail: subjects[0].next_micro_milestone ?? 'Clase 1',
    } : undefined;

    const upcomingExam = assessments
      ?.filter(a => a.due_date && !a.is_completed)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];

    const examDaysLeft = upcomingExam?.due_date ? calculateDaysLeft(upcomingExam.due_date) : null;

    return {
      health,
      recommendation,
      insights,
      courseCount: courses.length,
      subjectCount: subjects.length,
      globalProgress: { completed: completedClasses, total: totalClasses, percentage },
      upcomingExam: examDaysLeft !== null && upcomingExam ? {
        name: upcomingExam.name,
        daysLeft: examDaysLeft,
        isUrgent: examDaysLeft <= 7,
        isOverdue: examDaysLeft < 0,
      } : undefined,
    };
  }
}
