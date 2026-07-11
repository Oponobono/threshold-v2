import { PolicyRegistry } from '../policies/PolicyRegistry';
import { AssessmentPolicy } from '../policies/AssessmentPolicy';
import { ClassPolicy } from '../policies/ClassPolicy';
import { ReviewPolicy } from '../policies/ReviewPolicy';
import { EventPolicy } from '../policies/EventPolicy';
import { GradingPolicy } from '../policies/GradingPolicy';
import { SequenceFactory } from '../SequenceFactory';
import { ReminderEngine } from '../ReminderEngine';
import { ReminderCoordinator } from '../ReminderCoordinator';
import { ReminderSnapshotBuilder } from '../ReminderSnapshotBuilder';
import { FakeClock } from '../Clock';
import { InterruptionPolicy } from '../InterruptionPolicy';
import { TemplateResolver } from '../TemplateResolver';
import { NotificationReconciler } from '../NotificationReconciler';
import { RepositoryEventBus } from '../../events/RepositoryEventBus';
import type { NotificationProvider, ScheduledNotificationInfo } from '../NotificationProvider';
import type { I18nService } from '../I18nService';
import type { EntitySnapshot, ScheduledReminder } from '../types';

// ── Fake implementations ──────────────────────────────────────────

class FakeI18n implements I18nService {
  translate(key: string, params?: any): string {
    const map: Record<string, string> = {
      'entity.assessment': 'Examen',
      'entity.schedule': 'Clase',
      'entity.flashcard_deck': 'Mazo',
      'intentTitle.prepare_exam': 'Preparar {entity}',
      'intentTitle.attend_class': 'Asistir a {entity}',
      'intentTitle.review_cards': 'Repasar {entity}',
      'intentBody.prepare_exam': 'Tu {entity} se acerca.',
      'intentBody.attend_class': 'Tu {entity} comienza pronto.',
      'intentBody.review_cards': 'Tienes tarjetas pendientes.',
    };
    const template = map[key] ?? key;
    return template.replace('{entity}', params?.entity ?? '');
  }
}

class CaptureProvider implements NotificationProvider {
  readonly scheduled: ScheduledReminder[] = [];
  readonly cancelled: string[] = [];

  async requestPermissions(): Promise<boolean> { return true; }
  async setupChannels(): Promise<void> {}

  async schedule(reminder: ScheduledReminder): Promise<string> {
    this.scheduled.push(reminder);
    return reminder.id;
  }

  async cancel(id: string): Promise<void> {
    this.cancelled.push(id);
    const idx = this.scheduled.findIndex((r) => r.id === id);
    if (idx >= 0) this.scheduled.splice(idx, 1);
  }

  async cancelAll(prefix?: string): Promise<void> {
    if (prefix) {
      const toCancel = this.scheduled.filter((r) => r.id.startsWith(prefix)).map((r) => r.id);
      this.cancelled.push(...toCancel);
      for (const id of toCancel) {
        const idx = this.scheduled.findIndex((r) => r.id === id);
        if (idx >= 0) this.scheduled.splice(idx, 1);
      }
    } else {
      this.cancelled.push(...this.scheduled.map((r) => r.id));
      this.scheduled.length = 0;
    }
  }

  async getAll(): Promise<ScheduledNotificationInfo[]> {
    return this.scheduled.map((r) => ({
      identifier: r.id, title: r.title, body: r.body, triggerDate: r.scheduledAt,
    }));
  }

  reset(): void {
    this.scheduled.length = 0;
    this.cancelled.length = 0;
  }
}

// ── Session test infrastructure ───────────────────────────────────

const ANCHOR = new Date('2026-07-10T10:00:00Z');

interface SessionContext {
  clock: FakeClock;
  provider: CaptureProvider;
  engine: ReminderEngine;
  coordinator: ReminderCoordinator;
  eventBus: RepositoryEventBus;
}

function createSessionContext(): SessionContext {
  const clock = new FakeClock(ANCHOR);
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());
  registry.register(new GradingPolicy());

  const factory = new SequenceFactory(clock);
  const interruption = new InterruptionPolicy(clock);
  const templates = new TemplateResolver(new FakeI18n());
  const provider = new CaptureProvider();
  const reconciler = new NotificationReconciler();
  const engine = new ReminderEngine(registry, factory, interruption, templates, reconciler, provider, clock);
  const eventBus = new RepositoryEventBus();
  const coordinator = new ReminderCoordinator(engine, new ReminderSnapshotBuilder({} as any), {});

  return { clock, provider, engine, coordinator, eventBus };
}

type UserData = Record<string, any[]>;

const USER_A: UserData = {
  assessments: [{ id: 'a-user-a', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen A' }],
  schedules: [],
  flashcard_decks: [],
  grading_periods: [],
  calendar_events: [],
};

const USER_B: UserData = {
  assessments: [{ id: 'a-user-b', date: new Date('2026-07-20T10:00:00Z').toISOString(), title: 'Examen B' }],
  schedules: [],
  flashcard_decks: [],
  grading_periods: [],
  calendar_events: [],
};

const USER_C: UserData = {
  assessments: [{ id: 'a-user-c', date: new Date('2026-07-25T10:00:00Z').toISOString(), title: 'Examen C' }],
  schedules: [],
  flashcard_decks: [],
  grading_periods: [],
  calendar_events: [],
};

const EMPTY_USER: UserData = {
  assessments: [],
  schedules: [],
  flashcard_decks: [],
  grading_periods: [],
  calendar_events: [],
};

function snapshotFromUser(user: UserData): EntitySnapshot {
  return { ...user };
}

async function simulateLogin(ctx: SessionContext, user: UserData): Promise<void> {
  const snapshot = snapshotFromUser(user);
  await ctx.engine.initialize(snapshot);
  ctx.coordinator.subscribeToEventBus(ctx.eventBus);
}

function simulateLogout(ctx: SessionContext): void {
  ctx.coordinator.destroy();
  ctx.provider.reset();
}

// ── Sprint 6.1.2 — Session Isolation ──────────────────────────────

describe('Sprint 6.1.2 — Session Isolation', () => {
  describe('Escenario A — Happy path: A → logout → B', () => {
    it('no filtra estado entre usuarios', async () => {
      const ctx = createSessionContext();
      await simulateLogin(ctx, USER_A);

      expect(ctx.engine.getDesiredSequences()).toHaveLength(1);
      expect(ctx.engine.getDesiredSequences()[0].entityId).toBe('a-user-a');

      simulateLogout(ctx);

      const ctxB = createSessionContext();
      await simulateLogin(ctxB, USER_B);

      expect(ctxB.engine.getDesiredSequences()).toHaveLength(1);
      expect(ctxB.engine.getDesiredSequences()[0].entityId).toBe('a-user-b');
    });
  });

  describe('Escenario B — Doble logout', () => {
    it('no lanza excepciones ni deja estado', async () => {
      const ctx = createSessionContext();
      await simulateLogin(ctx, USER_A);

      simulateLogout(ctx);
      simulateLogout(ctx);

      expect(() => ctx.coordinator.destroy()).not.toThrow();
    });
  });

  describe('Escenario C — Login con snapshot vacío', () => {
    it('provider vacío, 0 secuencias', async () => {
      const ctxA = createSessionContext();
      await simulateLogin(ctxA, USER_A);
      expect(ctxA.engine.getDesiredSequences()).toHaveLength(1);

      simulateLogout(ctxA);
      ctxA.provider.reset();

      const ctxB = createSessionContext();
      await simulateLogin(ctxB, EMPTY_USER);

      expect(ctxB.engine.getDesiredSequences()).toHaveLength(0);
      expect(ctxB.provider.scheduled).toHaveLength(0);
    });
  });

  describe('Escenario D — Cambio inmediato: A→B→A', () => {
    it('no conserva estado estatico ni singletons entre ciclos', async () => {
      const ctx1 = createSessionContext();
      await simulateLogin(ctx1, USER_A);
      const seqs1 = ctx1.engine.getDesiredSequences();

      const ctx2 = createSessionContext();
      await simulateLogin(ctx2, USER_B);
      const seqs2 = ctx2.engine.getDesiredSequences();

      const ctx3 = createSessionContext();
      await simulateLogin(ctx3, USER_A);
      const seqs3 = ctx3.engine.getDesiredSequences();

      expect(seqs1.map((s) => s.entityId)).toEqual(seqs3.map((s) => s.entityId));
      expect(seqs2.map((s) => s.entityId)).toEqual(['a-user-b']);
    });
  });

  describe('Escenario E — Stress de sesiones (A→B→C→D→A)', () => {
    it('1 coordinator, 1 listener, 0 leaks', async () => {
      const eventBus = new RepositoryEventBus();

      const users: [string, UserData][] = [
        ['A', USER_A],
        ['B', USER_B],
        ['C', USER_C],
        ['A', USER_A],
      ];

      for (const [_name, user] of users) {
        const ctx = createSessionContext();
        ctx.eventBus = eventBus;
        await simulateLogin(ctx, user);

        const seqs = ctx.engine.getDesiredSequences();
        expect(seqs.length).toBeGreaterThanOrEqual(1);
        expect(seqs.every((s) => s.entityId === user.assessments[0]?.id)).toBe(true);

        simulateLogout(ctx);
      }

      expect(eventBus.listenerCount()).toBe(0);
    });
  });

  describe('Escenario F — Logout durante procesamiento', () => {
    it('no deja notificaciones huerfanas si se destruye mientras procesa', async () => {
      const ctx = createSessionContext();
      await simulateLogin(ctx, USER_A);

      ctx.provider.reset();

      const processing = ctx.engine.onEntityChanged('assessment', 'a-user-a', {
        id: 'a-user-a',
        date: new Date('2026-07-15T10:00:00Z').toISOString(),
        title: 'updated',
      });

      ctx.coordinator.destroy();
      await processing.catch(() => {});

      expect(ctx.provider.scheduled).toHaveLength(0);
    });
  });

  describe('Escenario G — EventBus listener cleanup', () => {
    it('suscribe y desuscribe correctamente', async () => {
      const eventBus = new RepositoryEventBus();
      expect(eventBus.listenerCount()).toBe(0);

      const ctx = createSessionContext();
      ctx.eventBus = eventBus;
      await simulateLogin(ctx, USER_A);

      expect(eventBus.listenerCount()).toBe(1);

      const handleChanged = jest.spyOn(ctx.coordinator, 'handleEntityChanged').mockResolvedValue(undefined);
      eventBus.emit({
        entityType: 'assessments',
        eventType: 'updated',
        entityId: 'a-user-a',
        entity: { id: 'a-user-a' },
        timestamp: Date.now(),
        priority: 'NORMAL',
      });
      expect(handleChanged).toHaveBeenCalled();

      ctx.coordinator.destroy();
      expect(eventBus.listenerCount()).toBe(0);
    });
  });
});
