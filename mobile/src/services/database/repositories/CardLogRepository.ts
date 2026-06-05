import { BaseRepository } from '../BaseRepository';
import type { CardLog } from '../../api/types';

export type { CardLog };

export class CardLogRepository extends BaseRepository<CardLog> {
  constructor() {
    super('card_logs');
  }

  async getByCard(cardId: string): Promise<CardLog[]> {
    return this.getByField('card_id', cardId);
  }

  async getPendingSync(userId: string): Promise<CardLog[]> {
    const db = this.getDb();
    return db.getAllAsync(
      `SELECT * FROM card_logs WHERE user_id = ? AND id LIKE 'pending-%' ORDER BY created_at ASC`, userId
    ) as Promise<CardLog[]>;
  }
}

export const cardLogRepository = new CardLogRepository();
