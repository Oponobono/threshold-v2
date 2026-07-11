import { RepositoryEventBus } from '../../events/RepositoryEventBus';
import { subscribeToEventBus } from '../subscribeToEventBus';

function createMockCoordinator() {
  return {
    handleEntityChanged: jest.fn().mockResolvedValue(undefined),
    handleEntityDeleted: jest.fn(),
  };
}

describe('subscribeToEventBus', () => {
  let eventBus: RepositoryEventBus;
  let coordinator: ReturnType<typeof createMockCoordinator>;
  let unsubscribe: () => void;

  beforeEach(() => {
    eventBus = new RepositoryEventBus();
    coordinator = createMockCoordinator();
    unsubscribe = subscribeToEventBus(coordinator as any, eventBus);
  });

  it('calls handleEntityChanged on created events for known entity types', () => {
    eventBus.emit({
      entityType: 'assessments',
      eventType: 'created',
      entityId: 'a1',
      entity: { id: 'a1' },
      timestamp: Date.now(),
      priority: 'NORMAL',
    });

    expect(coordinator.handleEntityChanged).toHaveBeenCalledWith('assessment', 'a1');
  });

  it('calls handleEntityChanged on updated events for known entity types', () => {
    eventBus.emit({
      entityType: 'flashcard_decks',
      eventType: 'updated',
      entityId: 'd1',
      entity: { id: 'd1' },
      timestamp: Date.now(),
      priority: 'NORMAL',
    });

    expect(coordinator.handleEntityChanged).toHaveBeenCalledWith('flashcard_deck', 'd1');
  });

  it('calls handleEntityDeleted on deleted events', () => {
    eventBus.emit({
      entityType: 'schedules',
      eventType: 'deleted',
      entityId: 's1',
      timestamp: Date.now(),
      priority: 'HIGH',
    });

    expect(coordinator.handleEntityDeleted).toHaveBeenCalledWith('schedule', 's1');
    expect(coordinator.handleEntityChanged).not.toHaveBeenCalled();
  });

  it('maps all 5 entity types correctly', () => {
    const types: [string, string][] = [
      ['assessments', 'assessment'],
      ['schedules', 'schedule'],
      ['flashcard_decks', 'flashcard_deck'],
      ['grading_periods', 'grading_period'],
      ['calendar_events', 'calendar_event'],
    ];

    for (const [tableName, engineType] of types) {
      eventBus.emit({
        entityType: tableName,
        eventType: 'updated',
        entityId: 'x1',
        entity: { id: 'x1' },
        timestamp: Date.now(),
        priority: 'NORMAL',
      });
      expect(coordinator.handleEntityChanged).toHaveBeenCalledWith(engineType, 'x1');
    }
  });

  it('ignores unknown entity types', () => {
    eventBus.emit({
      entityType: 'unknown_table',
      eventType: 'created',
      entityId: 'x1',
      entity: { id: 'x1' },
      timestamp: Date.now(),
      priority: 'NORMAL',
    });

    expect(coordinator.handleEntityChanged).not.toHaveBeenCalled();
    expect(coordinator.handleEntityDeleted).not.toHaveBeenCalled();
  });

  it('unsubscribe removes the listener', () => {
    unsubscribe();

    eventBus.emit({
      entityType: 'assessments',
      eventType: 'updated',
      entityId: 'a1',
      entity: { id: 'a1' },
      timestamp: Date.now(),
      priority: 'NORMAL',
    });

    expect(coordinator.handleEntityChanged).not.toHaveBeenCalled();
  });
});
