import { repositoryEventBus } from '../events/RepositoryEventBus';
import type { RepositoryEventBus } from '../events/RepositoryEventBus';
import type { ReminderCoordinator } from './ReminderCoordinator';

const TABLE_NAME_TO_ENGINE_TYPE: Record<string, string> = {
  assessments: 'assessment',
  schedules: 'schedule',
  flashcard_decks: 'flashcard_deck',
  grading_periods: 'grading_period',
  calendar_events: 'calendar_event',
};

export function subscribeToEventBus(
  coordinator: ReminderCoordinator,
  eventBus?: RepositoryEventBus,
): () => void {
  const bus = eventBus ?? repositoryEventBus;
  return bus.onAny((event) => {
    const engineType = TABLE_NAME_TO_ENGINE_TYPE[event.entityType];
    if (!engineType) return;

    if (event.eventType === 'deleted') {
      coordinator.handleEntityDeleted(engineType, event.entityId);
    } else {
      coordinator.handleEntityChanged(engineType, event.entityId).catch((err: unknown) => {
        console.warn(`[Reminder] EventBus: error handling ${event.entityType} changed:`, err);
      });
    }
  });
}
