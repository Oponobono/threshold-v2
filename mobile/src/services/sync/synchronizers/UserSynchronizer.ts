import { EntitySynchronizer } from '../EntitySynchronizer';
import { userRepository } from '../../database/repositories/UserRepository';
import { storageService } from '../../storageService';

export class UserSynchronizer implements EntitySynchronizer {
  readonly entityType = 'user';

  async saveAll(items: any[]): Promise<number> {
    const jwtToken = await storageService.getSecure('jwt_token') || '';
    let count = 0;
    for (const item of items) {
      await userRepository.upsert({ ...item, token: item.token || jwtToken });
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await userRepository.delete(id);
  }
}
