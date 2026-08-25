import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class AiChatSynchronizer implements EntitySynchronizer {
  readonly entityType = 'ai_chats';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.aiChats().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.aiChats().delete(id);
  }
}
