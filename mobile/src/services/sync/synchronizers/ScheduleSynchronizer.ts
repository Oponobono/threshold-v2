import { EntitySynchronizer } from '../EntitySynchronizer';
import { scheduleRepository } from '../../database/repositories/ScheduleRepository';

export class ScheduleSynchronizer implements EntitySynchronizer {
  readonly entityType = 'schedules';

  async saveAll(items: any[]): Promise<number> {
    await scheduleRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await scheduleRepository.delete(id);
  }
}
