import { EntitySynchronizer } from '../EntitySynchronizer';
import { lmsAccountRepository } from '../../database/repositories/LmsAccountRepository';

export class LmsAccountSynchronizer implements EntitySynchronizer {
  readonly entityType = 'lms_accounts';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await lmsAccountRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await lmsAccountRepository.delete(id);
  }
}
