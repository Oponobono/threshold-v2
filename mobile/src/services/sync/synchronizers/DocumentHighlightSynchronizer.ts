import { EntitySynchronizer } from '../EntitySynchronizer';
import { highlightRepository } from '../../database/repositories/HighlightRepository';

export class DocumentHighlightSynchronizer implements EntitySynchronizer {
  readonly entityType = 'document_highlights';

  async saveAll(items: any[]): Promise<number> {
    await highlightRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await highlightRepository.delete(id);
  }
}
