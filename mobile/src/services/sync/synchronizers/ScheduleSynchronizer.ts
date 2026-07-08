import { EntitySynchronizer } from '../EntitySynchronizer';
import { scheduleRepository } from '../../database/repositories/ScheduleRepository';

export class ScheduleSynchronizer implements EntitySynchronizer {
  readonly entityType = 'schedules';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await scheduleRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await scheduleRepository.delete(id);
  }
}
