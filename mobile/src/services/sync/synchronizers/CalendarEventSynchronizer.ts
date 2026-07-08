import { EntitySynchronizer } from '../EntitySynchronizer';
import { calendarEventRepository } from '../../database/repositories/CalendarEventRepository';

export class CalendarEventSynchronizer implements EntitySynchronizer {
  readonly entityType = 'calendar_events';

  async saveAll(items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      await calendarEventRepository.upsert(item);
      count++;
    }
    return count;
  }

  async deleteItem(id: string): Promise<void> {
    await calendarEventRepository.delete(id);
  }
}
