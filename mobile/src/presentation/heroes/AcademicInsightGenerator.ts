import type { Subject, Course, Assessment } from '../../services/api/types';
import { calculateDaysLeft } from '../../utils/date';

export interface GlobalInsight {
  title: string;
  subtitle: string;
  subtitles?: string[];
  icon: string;
  color: string;
  bgColor: string;
  priority: number;
}

export class AcademicInsightGenerator {
  static getTopInsights(
    input: { subjects: Subject[]; courses: Course[]; assessments?: Assessment[] },
    limit: number = 2
  ): GlobalInsight[] {
    const { subjects, courses, assessments } = input;
    const insights: GlobalInsight[] = [];

    const activeAssessments = assessments?.filter(a => a.due_date && !a.is_completed && calculateDaysLeft(a.due_date) <= 7) || [];
    const evaluationsThisWeek = activeAssessments.length;
    if (evaluationsThisWeek > 0) {
      insights.push({
        title: `${evaluationsThisWeek} ${evaluationsThisWeek === 1 ? 'evaluación' : 'evaluaciones'} esta semana`,
        subtitle: activeAssessments[0].name,
        subtitles: activeAssessments.map(a => a.name),
        icon: 'calendar-outline',
        color: '#EA580C', // Orange
        bgColor: '#FFF7ED',
        priority: 1,
      });
    }

    // Priority 2: Subjects needing attention
    const riskySubjects = subjects.filter(
      s => (s.avg_score !== undefined && s.target_grade !== undefined && s.avg_score < s.target_grade) || 
           (s.completion_percent !== undefined && s.completion_percent < 50)
    );
    const subjectsNeedingAttention = riskySubjects.length;
    if (subjectsNeedingAttention > 0) {
      insights.push({
        title: `${subjectsNeedingAttention} ${subjectsNeedingAttention === 1 ? 'materia en riesgo' : 'materias en riesgo'}`,
        subtitle: riskySubjects[0].name,
        subtitles: riskySubjects.map(s => s.name),
        icon: 'warning-outline',
        color: '#E11D48', // Rose
        bgColor: '#FFE4E6',
        priority: 2,
      });
    }

    // Priority 3: Classes programmed this week (simulated via active courses)
    // Here we check if there are courses in progress
    const activeCourses = courses.filter(c => c.completed_classes !== undefined && c.total_classes !== undefined && c.completed_classes < c.total_classes && c.completed_classes > 0).length;
    if (activeCourses > 0) {
      insights.push({
        title: `${activeCourses} ${activeCourses === 1 ? 'curso activo' : 'cursos activos'}`,
        subtitle: 'esta semana',
        icon: 'play-circle-outline',
        color: '#2563EB', // Blue
        bgColor: '#EFF6FF',
        priority: 3,
      });
    }

    // Priority 4: Study Streak (Since we don't have streak directly, we use courses completed)
    const completedCourses = courses.filter(c => c.completed_classes && c.total_classes && c.completed_classes >= c.total_classes).length;
    if (completedCourses > 0) {
      insights.push({
        title: `${completedCourses} ${completedCourses === 1 ? 'curso completado' : 'cursos completados'}`,
        subtitle: '¡Excelente trabajo!',
        icon: 'trophy-outline',
        color: '#16A34A', // Green
        bgColor: '#DCFCE7',
        priority: 4,
      });
    }

    // Sort by priority and take top N
    insights.sort((a, b) => a.priority - b.priority);
    let topInsights = insights.slice(0, limit);

    // Fallbacks if we don't have enough insights
    if (topInsights.length === 0) {
      if (subjects.length > 0) {
        topInsights.push({
          title: 'Semana despejada',
          subtitle: 'No hay actividades urgentes',
          icon: 'leaf-outline',
          color: '#059669', // Emerald
          bgColor: '#D1FAE5',
          priority: 99,
        });
      } else {
         topInsights.push({
          title: 'Bienvenido',
          subtitle: 'Agrega tu primera materia',
          icon: 'add-circle-outline',
          color: '#4F46E5', // Indigo
          bgColor: '#EEF2FF',
          priority: 100,
        });
      }
    }

    // If we only have 1 negative insight, we can pad with a positive one
    if (topInsights.length < limit && subjects.length > 0 && evaluationsThisWeek === 0) {
       topInsights.push({
          title: 'Todo al día',
          subtitle: 'Sigue así',
          icon: 'checkmark-circle-outline',
          color: '#4F46E5', // Indigo
          bgColor: '#EEF2FF',
          priority: 98,
        });
    }

    // Re-sort in case fallbacks were added
    topInsights.sort((a, b) => a.priority - b.priority);

    // Strip priority before returning (not needed in UI)
    return topInsights.slice(0, limit).map(({ priority, ...rest }) => rest) as any;
  }
}
