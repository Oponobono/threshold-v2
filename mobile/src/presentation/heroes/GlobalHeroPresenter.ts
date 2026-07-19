import type { Subject, Course, Assessment } from '../../services/api/types';
import type { GlobalHeroViewModel } from '../../types/heroViewModels';
import type { ContentType } from '../../types/content';
import { HealthScoringService } from '../../domain/knowledge/HealthScoringService';
import { formatRelativeTime } from '../../utils/relativeTime';
import { calculateDaysLeft } from '../../utils/date';

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

    const recentSubjects = subjects
      .filter(s => s.course_id)
      .sort((a, b) => {
        const dateA = a.next_micro_milestone ? new Date(a.next_micro_milestone).getTime() : 0;
        const dateB = b.next_micro_milestone ? new Date(b.next_micro_milestone).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 2);

    const recommendation = recentSubjects[0] ? {
      subjectName: recentSubjects[0].name,
      action: 'Continuar',
      detail: recentSubjects[0].next_micro_milestone ?? 'Clase 1',
    } : undefined;

    const upcomingExam = assessments
      ?.filter(a => a.due_date && !a.is_completed)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0];

    const examDaysLeft = upcomingExam?.due_date ? calculateDaysLeft(upcomingExam.due_date) : null;

    return {
      health,
      recommendation,
      recentActivity: recentSubjects.map(s => ({
        name: s.name,
        activityType: 'class' as ContentType,
        lastActivity: formatRelativeTime(s.next_micro_milestone),
      })),
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
