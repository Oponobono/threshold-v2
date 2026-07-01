import { EntitySynchronizer } from '../EntitySynchronizer';

export class UserSynchronizer implements EntitySynchronizer {
  readonly entityType = 'user';

  async saveAll(items: any[]): Promise<number> {
    const { userRepository } = await import('../../database/repositories/UserRepository');
    const { storageService } = await import('../../storageService');
    const jwtToken = await storageService.getSecure('jwt_token') || '';
    let count = 0;
    for (const item of items) {
      await userRepository.upsert({ ...item, token: item.token || jwtToken });
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { userRepository } = await import('../../database/repositories/UserRepository');
    await userRepository.delete(id);
  }
}
