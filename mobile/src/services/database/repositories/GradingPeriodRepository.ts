import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

export interface GradingPeriod {
  id: string;
  user_id: string;
  name: string;
  period_type: string;
  start_date: string | null;
  end_date: string | null;
  is_active: number | null;
  created_at: string | null;
}

export class GradingPeriodRepository extends SessionBoundRepository<GradingPeriod> {
  constructor(context: SessionBoundContext) {
    super('grading_periods', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<GradingPeriod>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }

  async getActive(): Promise<GradingPeriod[]> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT * FROM grading_periods WHERE user_id = ? AND is_active = 1 ORDER BY start_date DESC`,
      [this.context.userId]
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }
}

// export const gradingPeriodRepository = new GradingPeriodRepository();
