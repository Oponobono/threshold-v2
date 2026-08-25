import { RepositoryFactory } from '../../database/RepositoryFactory';
import { EntitySynchronizer } from '../EntitySynchronizer';

export class GroupMembershipSynchronizer implements EntitySynchronizer {
  readonly entityType = 'group_memberships';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.groupMemberships().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.groupMemberships().deleteWithPruning(id);
  }
}
