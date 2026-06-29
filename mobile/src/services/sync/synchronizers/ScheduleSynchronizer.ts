import { EntitySynchronizer } from '../EntitySynchronizer';

export class ScheduleSynchronizer implements EntitySynchronizer {
  readonly entityType = 'schedules';

  async saveAll(items: any[]): Promise<number> {
    const { scheduleRepository } = await import('../../database/repositories/ScheduleRepository');
    let count = 0;
    for (const item of items) {
      await scheduleRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { scheduleRepository } = await import('../../database/repositories/ScheduleRepository');
    await scheduleRepository.delete(id);
  }
}
