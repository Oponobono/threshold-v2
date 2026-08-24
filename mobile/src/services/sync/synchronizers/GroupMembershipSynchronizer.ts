import { EntitySynchronizer } from '../EntitySynchronizer';
import { groupMembershipRepository } from '../../database/repositories/GroupMembershipRepository';

export class GroupMembershipSynchronizer implements EntitySynchronizer {
  readonly entityType = 'group_memberships';

  async saveAll(items: any[]): Promise<number> {
    await groupMembershipRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await groupMembershipRepository.deleteWithPruning(id);
  }
}
