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

  async getAll(): Promise<CalendarEvent[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync(`
      SELECT ce.*, s.name as subject_name 
      FROM calendar_events ce
      LEFT JOIN subjects s ON ce.subject_id = s.id
    `);
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async getByUser(userId: string): Promise<CalendarEvent[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync(`
      SELECT ce.*, s.name as subject_name 
      FROM calendar_events ce
      LEFT JOIN subjects s ON ce.subject_id = s.id
      WHERE ce.user_id = ?
    `, userId);
    return (rows as any[]).map(row => this.mapRow(row));
  }
}

export const calendarEventRepository = new CalendarEventRepository();
