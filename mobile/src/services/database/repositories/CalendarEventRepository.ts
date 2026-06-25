import { BaseRepository } from '../BaseRepository';

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

export class CalendarEventRepository extends BaseRepository<CalendarEvent> {
  constructor() {
    super('calendar_events');
  }

  async getByUser(userId: string): Promise<CalendarEvent[]> {
    return this.getByField('user_id', userId);
  }
}

export const calendarEventRepository = new CalendarEventRepository();
