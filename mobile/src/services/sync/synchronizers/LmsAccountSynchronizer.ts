import { EntitySynchronizer } from '../EntitySynchronizer';
import { lmsAccountRepository } from '../../database/repositories/LmsAccountRepository';

export class LmsAccountSynchronizer implements EntitySynchronizer {
  readonly entityType = 'lms_accounts';

  async saveAll(items: any[]): Promise<number> {
    await lmsAccountRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await lmsAccountRepository.delete(id);
  }
}
