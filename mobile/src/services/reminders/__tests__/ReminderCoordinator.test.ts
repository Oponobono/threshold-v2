import { ReminderCoordinator } from '../ReminderCoordinator';
import type { ReminderSourceSnapshot, EnvironmentContext } from '../types';

function createMockEngine() {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn(),
    onEntityChanged: jest.fn(),
    onEntityDeleted: jest.fn(),
    onActionCompleted: jest.fn(),
    onReminderTapped: jest.fn(),
    onEnvironmentChanged: jest.fn(),
    getDesiredSequences: jest.fn().mockReturnValue([]),
    getTraceLog: jest.fn().mockReturnValue([]),
    clearTraceLog: jest.fn(),
  };
}

function createMockBuilder(snapshot?: ReminderSourceSnapshot) {
  return {
    build: jest.fn().mockResolvedValue(snapshot ?? {}),
  };
}

function createMockRepos(repoMap?: Record<string, any>) {
  const defaultRepos: Record<string, any> = {
    assessment: { getById: jest.fn().mockResolvedValue(null) },
    schedule: { getById: jest.fn().mockResolvedValue(null) },
    flashcard_deck: { getById: jest.fn().mockResolvedValue(null) },
    grading_period: { getById: jest.fn().mockResolvedValue(null) },
    calendar_event: { getById: jest.fn().mockResolvedValue(null) },
  };
  return { ...defaultRepos, ...repoMap };
}

describe('ReminderCoordinator', () => {
  describe('initialize', () => {
    it('builds snapshot and calls engine.initialize', async () => {
      const engine = createMockEngine();
      const snapshot: ReminderSourceSnapshot = { assessments: [{ id: 'a1' }] };
      const builder = createMockBuilder(snapshot);
      const coordinator = new ReminderCoordinator(engine as any, builder as any, createMockRepos());

      await coordinator.initialize();

      expect(builder.build).toHaveBeenCalledTimes(1);
      expect(engine.initialize).toHaveBeenCalledWith(snapshot);
      expect(coordinator.isInitialized).toBe(true);
    });

    it('is idempotent (second call does nothing)', async () => {
      const engine = createMockEngine();
      const builder = createMockBuilder({});
      const coordinator = new ReminderCoordinator(engine as any, builder as any, createMockRepos());

      await coordinator.initialize();
      await coordinator.initialize();

      expect(builder.build).toHaveBeenCalledTimes(1);
      expect(engine.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('resync', () => {
    it('rebuilds snapshot and re-initializes engine', async () => {
      const engine = createMockEngine();
      const builder = createMockBuilder({ assessments: [{ id: 'a2' }] });
      const coordinator = new ReminderCoordinator(engine as any, builder as any, createMockRepos());

      await coordinator.resync();

      expect(builder.build).toHaveBeenCalledTimes(1);
      expect(engine.initialize).toHaveBeenCalledWith({ assessments: [{ id: 'a2' }] });
    });

    it('works even when not initialized', async () => {
      const engine = createMockEngine();
      const builder = createMockBuilder({});
      const coordinator = new ReminderCoordinator(engine as any, builder as any, createMockRepos());

      await coordinator.resync();

      expect(engine.initialize).toHaveBeenCalledTimes(1);
      expect(coordinator.isInitialized).toBe(false);
    });
  });

  describe('destroy', () => {
    it('calls engine.destroy and resets initialized flag', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      coordinator.destroy();

      expect(engine.destroy).toHaveBeenCalledTimes(1);
      expect(coordinator.isInitialized).toBe(false);
    });
  });

  describe('handleEntityChanged', () => {
    it('fetches entity from repo and calls engine.onEntityChanged', async () => {
      const engine = createMockEngine();
      const entity = { id: 'a1', name: 'Examen' };
      const repos = createMockRepos({ assessment: { getById: jest.fn().mockResolvedValue(entity) } });
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, repos);

      await coordinator.handleEntityChanged('assessment', 'a1');

      expect(repos.assessment.getById).toHaveBeenCalledWith('a1');
      expect(engine.onEntityChanged).toHaveBeenCalledWith('assessment', 'a1', entity);
    });

    it('does nothing when entity not found in repo', async () => {
      const engine = createMockEngine();
      const repos = createMockRepos({ assessment: { getById: jest.fn().mockResolvedValue(null) } });
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, repos);

      await coordinator.handleEntityChanged('assessment', 'nonexistent');

      expect(engine.onEntityChanged).not.toHaveBeenCalled();
    });

    it('does nothing for unknown entity type', async () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      await coordinator.handleEntityChanged('unknown_type', 'x1');

      expect(engine.onEntityChanged).not.toHaveBeenCalled();
    });
  });

  describe('handleEntityDeleted', () => {
    it('calls engine.onEntityDeleted', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      coordinator.handleEntityDeleted('assessment', 'a1');

      expect(engine.onEntityDeleted).toHaveBeenCalledWith('assessment', 'a1');
    });
  });

  describe('handleActionCompleted', () => {
    it('calls engine.onActionCompleted', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      coordinator.handleActionCompleted('flashcard_deck', 'd1');

      expect(engine.onActionCompleted).toHaveBeenCalledWith('flashcard_deck', 'd1');
    });
  });

  describe('handleEnvironmentChanged', () => {
    it('calls engine.onEnvironmentChanged with context', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());
      const context: EnvironmentContext = { timezone: 'America/New_York', locale: 'es-AR' };

      coordinator.handleEnvironmentChanged(context);

      expect(engine.onEnvironmentChanged).toHaveBeenCalledWith(context);
    });
  });

  describe('handleReminderTapped', () => {
    it('calls engine.onReminderTapped', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      coordinator.handleReminderTapped('reminder-1');

      expect(engine.onReminderTapped).toHaveBeenCalledWith('reminder-1');
    });
  });

  describe('accessors', () => {
    it('getEngine returns the engine instance', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      expect(coordinator.getEngine()).toBe(engine);
    });

    it('getDesiredSequences delegates to engine', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      coordinator.getDesiredSequences();

      expect(engine.getDesiredSequences).toHaveBeenCalled();
    });

    it('getTraceLog delegates to engine', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      coordinator.getTraceLog();

      expect(engine.getTraceLog).toHaveBeenCalled();
    });

    it('clearTraceLog delegates to engine', () => {
      const engine = createMockEngine();
      const coordinator = new ReminderCoordinator(engine as any, createMockBuilder({}) as any, createMockRepos());

      coordinator.clearTraceLog();

      expect(engine.clearTraceLog).toHaveBeenCalled();
    });
  });
});
