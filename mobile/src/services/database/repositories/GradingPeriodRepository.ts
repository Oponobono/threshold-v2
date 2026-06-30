import { BaseRepository } from '../BaseRepository';

export interface GradingPeriod {
  id: string;
  user_id: string;
  name: string;
  period_type: string;
  start_date?: string;
  end_date?: string;
  is_active?: number;
  created_at?: string;
}

export class GradingPeriodRepository extends BaseRepository<GradingPeriod> {
  constructor() {
    super('grading_periods');
  }

  async getByUser(userId: string): Promise<GradingPeriod[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM grading_periods WHERE user_id = ? ORDER BY start_date DESC`,
      userId
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }
}

export const gradingPeriodRepository = new GradingPeriodRepository();
