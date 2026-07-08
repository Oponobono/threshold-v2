import { EntitySynchronizer } from '../EntitySynchronizer';
import { flashcardDeckRepository } from '../../database/repositories/FlashcardDeckRepository';
import { flashcardRepository } from '../../database/repositories/FlashcardRepository';

export class FlashcardSynchronizer implements EntitySynchronizer {
  readonly entityType = 'flashcards';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      if (item.deck) {
        await flashcardDeckRepository.upsert(item.deck);
        count++;
      }
      if (Array.isArray(item.cards)) {
        for (const card of item.cards) {
          await flashcardRepository.upsert(card);
          count++;
        }
      }
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await flashcardRepository.delete(id);
  }
}
