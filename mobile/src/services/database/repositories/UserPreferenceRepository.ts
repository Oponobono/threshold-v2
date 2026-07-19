import { BaseRepository } from '../BaseRepository';

export interface UserPreference {
  id: string;
  key: string;
  value: string;
  cloud_url?: string;
  is_backed_up?: number;
  updated_at?: string;
}

export class UserPreferenceRepository extends BaseRepository<UserPreference> {
  constructor() {
    super('user_preferences');
  }

  async getByKey(key: string): Promise<UserPreference | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync(
      `SELECT * FROM ${this.tableName} WHERE key = ?`,
      [key]
    );
    return row as UserPreference | null;
  }

  async upsertByKey(key: string, value: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO ${this.tableName} (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [key, value]
    );
  }

  async getPendingBackup(): Promise<UserPreference[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE (is_backed_up IS NULL OR is_backed_up = 0)`
    );
    return rows as UserPreference[];
  }

  async getAll(): Promise<UserPreference[]> {
    const db = this.getDb();
    return await db.getAllAsync(`SELECT * FROM ${this.tableName}`) as UserPreference[];
  }
}

export const userPreferenceRepository = new UserPreferenceRepository();
