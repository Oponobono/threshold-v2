import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class FlashcardDeckSynchronizer implements EntitySynchronizer {
  readonly entityType = 'flashcard_decks';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.flashcardDecks().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.flashcardDecks().delete(id);
  }
}
