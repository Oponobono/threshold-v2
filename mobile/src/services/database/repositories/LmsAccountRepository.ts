import { BaseRepository } from '../BaseRepository';

export interface LmsAccount {
  id: string;
  user_id: string;
  platform: string;
  instance_url?: string;
  username?: string;
  created_at?: string;
}

export class LmsAccountRepository extends BaseRepository<LmsAccount> {
  constructor() {
    super('lms_accounts');
  }

  async getByUser(userId: string): Promise<LmsAccount[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM lms_accounts WHERE user_id = ? ORDER BY created_at DESC`,
      userId
    );
    return (rows as any[]).map(row => this.mapRow(row));
  }
}

export const lmsAccountRepository = new LmsAccountRepository();
