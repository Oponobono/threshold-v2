import { RepositoryFactory } from '../../database/RepositoryFactory';
import { EntitySynchronizer } from '../EntitySynchronizer';
import { storageService } from '../../storageService';

export class UserSynchronizer implements EntitySynchronizer {
  readonly entityType = 'user';

  async saveAll(items: any[]): Promise<number> {
    const jwtToken = await storageService.getSecure('jwt_token') || '';
    let count = 0;
    for (const item of items) {
      await RepositoryFactory.users().upsert({ ...item, token: item.token || jwtToken });
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.users().delete(id);
  }
}
