import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

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

export class ScheduleRepository extends SessionBoundRepository<Schedule> {
  constructor(context: SessionBoundContext) {
    super('schedules', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<Schedule>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }
}

// export const scheduleRepository = new ScheduleRepository();
