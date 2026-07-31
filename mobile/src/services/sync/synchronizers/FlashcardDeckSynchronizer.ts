import { EntitySynchronizer } from '../EntitySynchronizer';
import { flashcardDeckRepository } from '../../database/repositories/FlashcardDeckRepository';

export class FlashcardDeckSynchronizer implements EntitySynchronizer {
  readonly entityType = 'flashcard_decks';

  async saveAll(items: any[]): Promise<number> {
    await flashcardDeckRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await flashcardDeckRepository.delete(id);
  }
}
