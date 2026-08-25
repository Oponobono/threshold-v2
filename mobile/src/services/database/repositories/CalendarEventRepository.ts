import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';
import { databaseService } from '../DatabaseService';

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  all_day?: number;
  subject_id?: string;
  linked_deck_id?: string;
  study_plan_flag?: number;
  created_at?: string;
  updated_at?: string;
}

export class CalendarEventRepository extends SessionBoundRepository<CalendarEvent> {
  constructor(context: SessionBoundContext) {
    super('calendar_events', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<CalendarEvent>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }

  async getAllWithSubjects(): Promise<CalendarEvent[]> {
    this.requireValidSession();
    const rows = await databaseService.getAllTracked(
      `SELECT ce.*, s.name as subject_name 
       FROM calendar_events ce
       LEFT JOIN subjects s ON ce.subject_id = s.id AND s.deleted_at IS NULL
       WHERE ce.deleted_at IS NULL AND ce.user_id = ?`,
      [this.context.userId],
      'CalendarEventRepo.getAllWithSubjects'
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }
}

// export const calendarEventRepository = new CalendarEventRepository();
