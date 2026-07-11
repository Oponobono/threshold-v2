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
import type { EntitySnapshot, ScheduledReminder, ReminderSequence } from '../types';

// ── Fakes compartidos ──────────────────────────────────────────────

class FakeI18n implements I18nService {
  translate(key: string, params?: any): string {
    const map: Record<string, string> = {
      'entity.assessment': 'Examen',
      'entity.schedule': 'Clase',
      'entity.flashcard_deck': 'Mazo',
      'entity.calendar_event': 'Evento',
      'entity.grading_period': 'Periodo',
      'intentTitle.prepare_exam': 'Preparar {entity}',
      'intentTitle.attend_class': 'Asistir a {entity}',
      'intentTitle.review_cards': 'Repasar {entity}',
      'intentTitle.follow_up': 'Seguimiento {entity}',
      'intentTitle.submit_work': 'Entregar {entity}',
      'intentBody.prepare_exam': 'Tu {entity} se acerca.',
      'intentBody.attend_class': 'Tu {entity} comienza pronto.',
      'intentBody.review_cards': 'Tienes tarjetas pendientes de {entity}.',
      'intentBody.follow_up': 'Revisa {entity}.',
      'intentBody.submit_work': 'Entrega pendiente de {entity}.',
    };
    const template = map[key] ?? key;
    const entityName = params?.entity ?? '';
    return template.replace('{entity}', entityName);
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
      identifier: r.id,
      title: r.title,
      body: r.body,
      triggerDate: r.scheduledAt,
    }));
  }

  reset(): void {
    this.scheduled.length = 0;
    this.cancelled.length = 0;
  }
}

class FakeRepos {
  assessments: { getAll: () => Promise<any[]> };
  schedules: { getAll: () => Promise<any[]> };
  flashcard_decks: { getAll: () => Promise<any[]> };
  grading_periods: { getAll: () => Promise<any[]> };
  calendar_events: { getAll: () => Promise<any[]> };

  private _store: Record<string, any[]> = {};

  constructor(initialData?: Record<string, any[]>) {
    this.assessments = { getAll: async () => [] };
    this.schedules = { getAll: async () => [] };
    this.flashcard_decks = { getAll: async () => [] };
    this.grading_periods = { getAll: async () => [] };
    this.calendar_events = { getAll: async () => [] };
    if (initialData) this.load(initialData);
  }

  load(data: Record<string, any[]>): void {
    this._store = {};
    for (const key of ['assessments', 'schedules', 'flashcard_decks', 'grading_periods', 'calendar_events']) {
      this._store[key] = [...(data[key] ?? [])];
    }
    this._rebuild();
  }

  private _rebuild(): void {
    this.assessments = { getAll: async () => [...(this._store.assessments ?? [])] };
    this.schedules = { getAll: async () => [...(this._store.schedules ?? [])] };
    this.flashcard_decks = { getAll: async () => [...(this._store.flashcard_decks ?? [])] };
    this.grading_periods = { getAll: async () => [...(this._store.grading_periods ?? [])] };
    this.calendar_events = { getAll: async () => [...(this._store.calendar_events ?? [])] };
  }
}

// ── Helpers ────────────────────────────────────────────────────────

const ANCHOR = new Date('2026-07-10T10:00:00Z');

interface EngineContext {
  clock: FakeClock;
  provider: CaptureProvider;
  engine: ReminderEngine;
}

function createEngineContext(): EngineContext {
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

  return { clock, provider, engine };
}

function emptySnapshot(): EntitySnapshot {
  return {
    assessments: [],
    schedules: [],
    flashcard_decks: [],
    grading_periods: [],
    calendar_events: [],
  };
}

function assessmentEntity(id: string, overrides: Record<string, any> = {}): any {
  return {
    id,
    date: new Date('2026-07-15T10:00:00Z').toISOString(),
    title: 'Examen',
    ...overrides,
  };
}

// ── Regression Suite ───────────────────────────────────────────────

describe('Reminder System — Regression Suite', () => {

  // ── 1. Event Storm ──────────────────────────────────────────────
  describe('1. Event Storm', () => {
    it('create + 5 updates + delete → 0 sequences', async () => {
      const { engine, provider } = createEngineContext();
      await engine.initialize(emptySnapshot());

      const id = 'storm-1';
      await engine.onEntityChanged('assessment', id, assessmentEntity(id));
      await engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v2' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v3' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v4' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v5' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v6' }));
      await engine.onEntityDeleted('assessment', id);

      expect(engine.getDesiredSequences()).toHaveLength(0);
      expect(provider.scheduled).toHaveLength(0);
    });

    it('10 concurrent events en Promise.all → FIFO, converge a 0', async () => {
      const { engine } = createEngineContext();
      await engine.initialize(emptySnapshot());

      const id = 'storm-concurrent';
      await Promise.all([
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v1' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v2' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v3' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v4' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v5' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v6' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v7' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v8' })),
        engine.onEntityChanged('assessment', id, assessmentEntity(id, { title: 'v9' })),
        engine.onEntityDeleted('assessment', id),
      ]);

      expect(engine.getDesiredSequences()).toHaveLength(0);
    });
  });

  // ── 2. Session Isolation ─────────────────────────────────────────
  describe('2. Session Isolation', () => {
    it('A → logout → B → no state leak between sessions', async () => {
      const ctxA = createEngineContext();
      const reposA = new FakeRepos({
        assessments: [{ id: 'a-user-a', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen A' }],
        schedules: [], flashcard_decks: [], grading_periods: [], calendar_events: [],
      });
      const builderA = new ReminderSnapshotBuilder(reposA);
      const coordinatorA = new ReminderCoordinator(ctxA.engine, builderA, {});
      await coordinatorA.initialize();
      expect(ctxA.engine.getDesiredSequences()).toHaveLength(1);
      expect(ctxA.engine.getDesiredSequences()[0].entityId).toBe('a-user-a');

      coordinatorA.destroy();

      const ctxB = createEngineContext();
      const reposB = new FakeRepos({
        assessments: [{ id: 'a-user-b', date: new Date('2026-07-20T10:00:00Z').toISOString(), title: 'Examen B' }],
        schedules: [], flashcard_decks: [], grading_periods: [], calendar_events: [],
      });
      const builderB = new ReminderSnapshotBuilder(reposB);
      const coordinatorB = new ReminderCoordinator(ctxB.engine, builderB, {});
      await coordinatorB.initialize();
      expect(ctxB.engine.getDesiredSequences()).toHaveLength(1);
      expect(ctxB.engine.getDesiredSequences()[0].entityId).toBe('a-user-b');
    });
  });

  // ── 3. Delta Convergence ─────────────────────────────────────────
  describe('3. Delta Convergence', () => {
    async function assertConvergence(
      initialData: Record<string, any[]>,
      deltas: Array<{ type: string; entityType: string; entity?: any; entityId?: string }>,
    ): Promise<void> {
      const ctx = createEngineContext();
      const repos = new FakeRepos(initialData);

      const snapshot = await new ReminderSnapshotBuilder(repos).build();
      await ctx.engine.initialize(snapshot);

      for (const d of deltas) {
        if (d.type === 'create' || d.type === 'update') {
          repos.assessments = { getAll: async () => [{ ...d.entity }] };
          await ctx.engine.onEntityChanged(d.entityType, d.entity.id, d.entity);
        } else {
          const key = d.entityType === 'assessment' ? 'assessments' : d.entityType + 's';
          (repos as any)[key] = { getAll: async () => [] };
          await ctx.engine.onEntityDeleted(d.entityType, d.entityId!);
        }
      }

      const stateAfterDeltas = {
        sequences: ctx.engine.getDesiredSequences(),
        scheduled: [...ctx.provider.scheduled],
      };

      const fullSnapshot = await new ReminderSnapshotBuilder(repos).build();
      await ctx.engine.initialize(fullSnapshot);

      const stateAfterSnapshot = {
        sequences: ctx.engine.getDesiredSequences(),
        scheduled: [...ctx.provider.scheduled],
      };

      expect(stateAfterSnapshot.sequences).toEqual(stateAfterDeltas.sequences);
    }

    it('delta path ≡ snapshot path para CREATE+UPDATE+DELETE', async () => {
      await assertConvergence(
        {},
        [
          { type: 'create', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen' } },
          { type: 'update', entityType: 'assessment', entity: { id: 'a1', date: new Date('2026-07-16T10:00:00Z').toISOString(), title: 'Movido' } },
          { type: 'delete', entityType: 'assessment', entityId: 'a1' },
        ],
      );
    });
  });

  // ── 4. Resync ────────────────────────────────────────────────────
  describe('4. Resync', () => {
    it('resync con mismos datos no altera estado', async () => {
      const ctx = createEngineContext();
      const repos = new FakeRepos({
        assessments: [{ id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen' }],
        schedules: [], flashcard_decks: [], grading_periods: [], calendar_events: [],
      });

      const snapshot1 = await new ReminderSnapshotBuilder(repos).build();
      await ctx.engine.initialize(snapshot1);
      const state1 = ctx.engine.getDesiredSequences();

      const snapshot2 = await new ReminderSnapshotBuilder(repos).build();
      await ctx.engine.initialize(snapshot2);
      const state2 = ctx.engine.getDesiredSequences();

      expect(state2).toEqual(state1);
    });
  });

  // ── 5. Logout/Login ──────────────────────────────────────────────
  describe('5. Logout/Login', () => {
    it('destroy → create → initialize no retiene estado previo', async () => {
      const ctx1 = createEngineContext();
      const repos1 = new FakeRepos({
        assessments: [{ id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Sesion 1' }],
        schedules: [], flashcard_decks: [], grading_periods: [], calendar_events: [],
      });
      const coord1 = new ReminderCoordinator(ctx1.engine, new ReminderSnapshotBuilder(repos1), {});
      await coord1.initialize();
      expect(ctx1.engine.getDesiredSequences()).toHaveLength(1);
      coord1.destroy();

      const ctx2 = createEngineContext();
      const repos2 = new FakeRepos({
        assessments: [{ id: 'a2', date: new Date('2026-07-20T10:00:00Z').toISOString(), title: 'Sesion 2' }],
        schedules: [], flashcard_decks: [], grading_periods: [], calendar_events: [],
      });
      const coord2 = new ReminderCoordinator(ctx2.engine, new ReminderSnapshotBuilder(repos2), {});
      await coord2.initialize();
      expect(ctx2.engine.getDesiredSequences()).toHaveLength(1);
      expect(ctx2.engine.getDesiredSequences()[0].entityId).toBe('a2');
      coord2.destroy();
    });
  });

  // ── 6. Double initialize() ───────────────────────────────────────
  describe('6. Double initialize()', () => {
    it('segundo initialize() es no-op', async () => {
      const ctx = createEngineContext();
      const repos = new FakeRepos({
        assessments: [{ id: 'a1', date: new Date('2026-07-15T10:00:00Z').toISOString(), title: 'Examen' }],
        schedules: [], flashcard_decks: [], grading_periods: [], calendar_events: [],
      });
      const coordinator = new ReminderCoordinator(ctx.engine, new ReminderSnapshotBuilder(repos), {});
      await coordinator.initialize();
      const state1 = ctx.engine.getDesiredSequences();

      await coordinator.initialize();
      const state2 = ctx.engine.getDesiredSequences();

      expect(state2).toEqual(state1);
      coordinator.destroy();
    });
  });

  // ── 7. Double destroy() ──────────────────────────────────────────
  describe('7. Double destroy()', () => {
    it('segundo destroy() no lanza excepcion', async () => {
      const ctx = createEngineContext();
      const coordinator = new ReminderCoordinator(ctx.engine, new ReminderSnapshotBuilder(new FakeRepos()), {});
      await coordinator.initialize();

      expect(() => {
        coordinator.destroy();
        coordinator.destroy();
      }).not.toThrow();
    });
  });

  // ── 8. Event Repetition ──────────────────────────────────────────
  describe('8. Event Repetition', () => {
    it('mismo evento repetido produce mismo estado final', async () => {
      const ctx = createEngineContext();
      await ctx.engine.initialize(emptySnapshot());

      const id = 'repeat-1';
      await ctx.engine.onEntityChanged('assessment', id, assessmentEntity(id));
      await ctx.engine.onEntityChanged('assessment', id, assessmentEntity(id));
      await ctx.engine.onEntityChanged('assessment', id, assessmentEntity(id));

      expect(ctx.engine.getDesiredSequences()).toHaveLength(1);
      expect(ctx.engine.getDesiredSequences()[0].entityId).toBe(id);
    });

    it('repetir secuencia CREATE+DELETE produce mismo resultado', async () => {
      const runSequence = async () => {
        const { engine } = createEngineContext();
        await engine.initialize(emptySnapshot());
        const id = 'repeat-seq';
        await engine.onEntityChanged('assessment', id, assessmentEntity(id));
        await engine.onEntityDeleted('assessment', id);
        return engine.getDesiredSequences();
      };

      const r1 = await runSequence();
      const r2 = await runSequence();

      expect(r1).toEqual(r2);
    });
  });
});
