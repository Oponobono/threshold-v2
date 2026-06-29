import { BaseQuery } from './BaseQuery';

export interface TodaySchedule {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectColor?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroom?: string;
}

export class TodaySchedulesQuery extends BaseQuery<TodaySchedule> {
  constructor(private userId: string) { super(); }

  protected sql(): string {
    return `
      SELECT s.id, s.subject_id as subjectId, sub.name as subjectName,
             sub.color as subjectColor, s.day_of_week as dayOfWeek,
             s.start_time as startTime, s.end_time as endTime, s.classroom
      FROM schedules s
      LEFT JOIN subjects sub ON s.subject_id = sub.id
      WHERE s.user_id = ? AND s.is_active = 1
      ORDER BY s.start_time ASC
    `;
  }

  protected params(): any[] {
    const dayOfWeek = new Date().getDay();
    return [this.userId, dayOfWeek];
  }

  protected mapRow(row: any): TodaySchedule {
    return {
      id: row.id,
      subjectId: row.subjectId,
      subjectName: row.subjectName || '',
      subjectColor: row.subjectColor,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      classroom: row.classroom,
    };
  }
}
