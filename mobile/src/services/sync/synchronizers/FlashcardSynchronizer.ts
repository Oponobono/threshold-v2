import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class FlashcardSynchronizer implements EntitySynchronizer {
  readonly entityType = 'flashcards';

  async saveAll(items: any[]): Promise<number> {
    const validItems = items.filter(item => item.id && item.deck_id);
    if (validItems.length > 0) {
      await RepositoryFactory.flashcards().upsertMany(validItems);
    }
    return validItems.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.flashcards().delete(id);
  }
}
