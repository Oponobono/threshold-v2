import { EntitySynchronizer } from '../EntitySynchronizer';
import { RepositoryFactory } from '../../database/RepositoryFactory';

export class CalendarEventSynchronizer implements EntitySynchronizer {
  readonly entityType = 'calendar_events';

  async saveAll(items: any[]): Promise<number> {
    await RepositoryFactory.calendarEvents().upsertMany(items);
    return items.length;
  }

  async deleteItem(id: string): Promise<void> {
    await RepositoryFactory.calendarEvents().delete(id);
  }
}
