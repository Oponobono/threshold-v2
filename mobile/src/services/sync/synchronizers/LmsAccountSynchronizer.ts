import { EntitySynchronizer } from '../EntitySynchronizer';

export class LmsAccountSynchronizer implements EntitySynchronizer {
  readonly entityType = 'lms_accounts';

  async saveAll(items: any[]): Promise<number> {
    const { lmsAccountRepository } = await import('../../database/repositories/LmsAccountRepository');
    let count = 0;
    for (const item of items) {
      await lmsAccountRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { lmsAccountRepository } = await import('../../database/repositories/LmsAccountRepository');
    await lmsAccountRepository.delete(id);
  }
}
