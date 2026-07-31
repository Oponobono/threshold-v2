import { EntitySynchronizer } from '../EntitySynchronizer';
import { flashcardDeckRepository } from '../../database/repositories/FlashcardDeckRepository';
import { flashcardRepository } from '../../database/repositories/FlashcardRepository';

export class FlashcardSynchronizer implements EntitySynchronizer {
  readonly entityType = 'flashcards';

  async saveAll(items: any[]): Promise<number> {
    const validItems = items.filter(item => item.id && item.deck_id);
    if (validItems.length > 0) {
      await flashcardRepository.upsertMany(validItems);
    }
    return validItems.length;
  }

  async deleteItem(id: string): Promise<void> {
    await flashcardRepository.delete(id);
  }
}
