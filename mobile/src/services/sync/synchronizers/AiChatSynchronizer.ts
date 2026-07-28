import { EntitySynchronizer } from '../EntitySynchronizer';
import { aiChatRepository } from '../../database/repositories/AiChatRepository';

export class AiChatSynchronizer implements EntitySynchronizer {
  readonly entityType = 'ai_chats';

  async saveAll(items: any[]): Promise<number> {
    await aiChatRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await aiChatRepository.delete(id);
  }
}
