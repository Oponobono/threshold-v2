import { RepositoryFactory } from '../../database/RepositoryFactory';
import { EntitySynchronizer } from '../EntitySynchronizer';

export class LmsAccountSynchronizer implements EntitySynchronizer {
  readonly entityType = 'lms_accounts';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.lmsAccounts().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.lmsAccounts().delete(id);
  }
}
