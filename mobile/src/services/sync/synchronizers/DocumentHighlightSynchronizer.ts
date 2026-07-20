import { EntitySynchronizer } from '../EntitySynchronizer';
import { highlightRepository } from '../../database/repositories/HighlightRepository';

export class DocumentHighlightSynchronizer implements EntitySynchronizer {
  readonly entityType = 'document_highlights';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await highlightRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await highlightRepository.delete(id);
  }
}
