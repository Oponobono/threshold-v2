import { BaseQuery } from './BaseQuery';

export interface NextExam {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectColor?: string;
  title: string;
  date: string;
  weight: number;
  maxScore: number;
}

export class NextExamQuery extends BaseQuery<NextExam> {
  constructor(private userId: string) { super(); }

  protected sql(): string {
    return `
      SELECT a.id, a.subject_id as subjectId, sub.name as subjectName,
             sub.color as subjectColor, a.title, a.date, a.weight, a.max_score as maxScore
      FROM assessments a
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      WHERE a.user_id = ? AND a.date >= datetime('now')
      ORDER BY a.date ASC
      LIMIT 1
    `;
  }

  protected params(): any[] {
    return [this.userId];
  }

  protected mapRow(row: any): NextExam {
    return {
      id: row.id,
      subjectId: row.subjectId,
      subjectName: row.subjectName || '',
      subjectColor: row.subjectColor,
      title: row.title,
      date: row.date,
      weight: row.weight,
      maxScore: row.maxScore,
    };
  }
}
