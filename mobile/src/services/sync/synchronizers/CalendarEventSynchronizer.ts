import { EntitySynchronizer } from '../EntitySynchronizer';

export class CalendarEventSynchronizer implements EntitySynchronizer {
  readonly entityType = 'calendar_events';

  async saveAll(items: any[]): Promise<number> {
    const { calendarEventRepository } = await import('../../database/repositories/CalendarEventRepository');
    let count = 0;
    for (const item of items) {
      await calendarEventRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    const { calendarEventRepository } = await import('../../database/repositories/CalendarEventRepository');
    await calendarEventRepository.delete(id);
  }
}
