import { EntitySynchronizer } from '../EntitySynchronizer';
import { groupRepository } from '../../database/repositories/GroupRepository';

export class GroupSynchronizer implements EntitySynchronizer {
  readonly entityType = 'groups';

  async saveAll(items: any[]): Promise<number> {
    await groupRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await groupRepository.delete(id);
  }
}
