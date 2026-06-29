import { EntitySynchronizer } from '../EntitySynchronizer';

export class FlashcardSynchronizer implements EntitySynchronizer {
  readonly entityType = 'flashcards';

  async saveAll(items: any[]): Promise<number> {
    const { flashcardDeckRepository } = await import('../../database/repositories/FlashcardDeckRepository');
    const { flashcardRepository } = await import('../../database/repositories/FlashcardRepository');
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
    const { flashcardRepository } = await import('../../database/repositories/FlashcardRepository');
    await flashcardRepository.delete(id);
  }
}
