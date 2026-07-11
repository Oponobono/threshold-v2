import { EntitySynchronizer } from '../EntitySynchronizer';
import { aiChatRepository } from '../../database/repositories/AiChatRepository';

export class AiChatSynchronizer implements EntitySynchronizer {
  readonly entityType = 'ai_chats';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await aiChatRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await aiChatRepository.delete(id);
  }
}
