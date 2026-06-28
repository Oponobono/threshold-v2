import { BaseRepository } from '../BaseRepository';

export interface AiChat {
  id: string;
  user_id: string;
  subject_id?: string;
  role: string;
  content: string;
  cloud_url?: string;
  is_backed_up?: number;
  created_at?: string;
}

export class AiChatRepository extends BaseRepository<AiChat> {
  constructor() {
    super('ai_chats');
  }

  async getByUser(userId: string): Promise<AiChat[]> {
    return this.getByField('user_id', userId);
  }

  async getBySubject(subjectId: string): Promise<AiChat[]> {
    return this.getByField('subject_id', subjectId);
  }

  async getRecentByUser(userId: string, limit: number = 50): Promise<AiChat[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );
    return rows as AiChat[];
  }

  async getPendingBackup(userId: string): Promise<AiChat[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync(
      `SELECT * FROM ${this.tableName} WHERE user_id = ? AND (is_backed_up IS NULL OR is_backed_up = 0) AND content IS NOT NULL AND content != '' ORDER BY created_at ASC`,
      [userId]
    );
    return rows as AiChat[];
  }
}

export const aiChatRepository = new AiChatRepository();
