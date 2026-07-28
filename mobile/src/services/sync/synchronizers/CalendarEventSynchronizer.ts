import { EntitySynchronizer } from '../EntitySynchronizer';
import { calendarEventRepository } from '../../database/repositories/CalendarEventRepository';

export class CalendarEventSynchronizer implements EntitySynchronizer {
  readonly entityType = 'calendar_events';

  async saveAll(items: any[]): Promise<number> {
    await calendarEventRepository.upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await calendarEventRepository.delete(id);
  }
}
