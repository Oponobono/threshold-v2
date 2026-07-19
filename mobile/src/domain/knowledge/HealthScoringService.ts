import type { Subject } from '../../services/api/types';

export class HealthScoringService {
  static calculateFromSubjects(subjects: Subject[]): number {
    const withGrade = subjects.filter(s => (s.avg_score ?? 0) > 0);
    if (withGrade.length === 0) return 0;
    const avg = withGrade.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / withGrade.length;
    return Math.round((avg / 5) * 100);
  }
}
