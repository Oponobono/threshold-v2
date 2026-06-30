import { BaseRepository } from '../BaseRepository';

export interface ThresholdOverride {
  id: string;
  user_id: string;
  subject_id?: string;
  threshold: number;
  created_at?: string;
}

export class ThresholdOverrideRepository extends BaseRepository<ThresholdOverride> {
  constructor() {
    super('subject_threshold_overrides');
  }

  async getByUser(userId: string): Promise<ThresholdOverride[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM subject_threshold_overrides WHERE user_id = ?`,
      userId
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }

  async deleteByUser(userId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM subject_threshold_overrides WHERE user_id = ?`, userId);
  }

  async replaceAll(items: any[]): Promise<number> {
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM subject_threshold_overrides`);
    let count = 0;
    for (const item of items) {
      await this.upsert(item);
      count++;
    }
    return count;
  }
}

export const thresholdOverrideRepository = new ThresholdOverrideRepository();
