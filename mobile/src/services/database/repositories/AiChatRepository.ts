import { SessionBoundRepository } from '../SessionBoundRepository';
import { SessionBoundContext } from '../../api/auth/SessionIdentity';

export interface AiChat {
  id: string;
  user_id: string;
  subject_id?: string;
  role: string;
  content: string;
  cloud_url?: string;
  is_backed_up?: number;
  created_at?: string;
  updated_at?: string;
  sync_version?: number;
  version_number?: number;
  last_modified_by?: string;
  deleted_at?: string;
}

export class AiChatRepository extends SessionBoundRepository<AiChat> {
  constructor(context: SessionBoundContext) {
    super('ai_chats', context);
  }

  protected buildOwnershipWhereClause(): string {
    return 'user_id = ?';
  }

  protected enforceCreateOwnership(data: Partial<AiChat>): void {
    if (data.user_id !== undefined && data.user_id !== this.context.userId)
      throw new Error('ILLEGAL_CREATE: user_id cannot be set by caller');
    data.user_id = this.context.userId;
  }

  async getRecentByUser(limit: number = 50): Promise<AiChat[]> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT * FROM ai_chats WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`,
      [this.context.userId, limit]
    );
    return rows as AiChat[];
  }

  async getPendingBackup(): Promise<AiChat[]> {
    this.requireValidSession();
    const db = this.getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT * FROM ai_chats WHERE user_id = ? AND (is_backed_up IS NULL OR is_backed_up = 0) AND content IS NOT NULL AND content != '' ORDER BY created_at ASC`,
      [this.context.userId]
    );
    return rows as AiChat[];
  }
}

// export const aiChatRepository = new AiChatRepository();
