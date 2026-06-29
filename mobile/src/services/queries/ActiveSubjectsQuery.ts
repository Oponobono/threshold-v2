import { BaseQuery } from './BaseQuery';

export interface ActiveSubject {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  courseId?: string;
  courseName?: string;
  completionPercent?: number;
  avgScore?: number;
}

export class ActiveSubjectsQuery extends BaseQuery<ActiveSubject> {
  constructor(private userId: string) { super(); }

  protected sql(): string {
    return `
      SELECT sub.id, sub.name, sub.color, sub.icon,
             sub.course_id as courseId, c.name as courseName,
             sub.completion_percent as completionPercent,
             sub.avg_score as avgScore
      FROM subjects sub
      LEFT JOIN courses c ON sub.course_id = c.id
      WHERE sub.user_id = ?
      ORDER BY sub.name ASC
    `;
  }

  protected params(): any[] {
    return [this.userId];
  }

  protected mapRow(row: any): ActiveSubject {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      courseId: row.courseId,
      courseName: row.courseName,
      completionPercent: row.completionPercent,
      avgScore: row.avgScore,
    };
  }
}
