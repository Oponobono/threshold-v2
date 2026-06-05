import { BaseRepository } from '../BaseRepository';

export interface Schedule {
  id: string;
  user_id: string;
  subject_id?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  name?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export class ScheduleRepository extends BaseRepository<Schedule> {
  constructor() {
    super('schedules');
  }

  async getByUser(userId: string): Promise<Schedule[]> {
    return this.getByField('user_id', userId);
  }

  async getBySubject(subjectId: string): Promise<Schedule[]> {
    return this.getByField('subject_id', subjectId);
  }
}

export const scheduleRepository = new ScheduleRepository();
