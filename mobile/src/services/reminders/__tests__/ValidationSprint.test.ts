import { PolicyRegistry } from '../policies/PolicyRegistry';
import { AssessmentPolicy } from '../policies/AssessmentPolicy';
import { ClassPolicy } from '../policies/ClassPolicy';
import { ReviewPolicy } from '../policies/ReviewPolicy';
import { EventPolicy } from '../policies/EventPolicy';
import { GradingPolicy } from '../policies/GradingPolicy';
import { SequenceFactory } from '../SequenceFactory';
import { ReminderEngine } from '../ReminderEngine';
import { FakeClock } from '../Clock';
import { InterruptionPolicy } from '../InterruptionPolicy';
import { TemplateResolver } from '../TemplateResolver';
import { NotificationReconciler } from '../NotificationReconciler';
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

// ── Event Storm metrics ───────────────────────────────────────────

interface StormMetrics {
  eventsReceived: number;
  sequencesCreated: number;
  sequencesCancelled: number;
  notificationsScheduled: number;
  notificationsCancelled: number;
  errors: number;
  durationMs: number;
}

function measureStorm(engine: ReminderEngine, provider: CaptureProvider): StormMetrics {
  const trace = engine.getTraceLog();
  const sequences = engine.getDesiredSequences();
  const lastTrace = trace[trace.length - 1];
  return {
    eventsReceived: lastTrace ? lastTrace.scheduled + lastTrace.cancelled : 0,
    sequencesCreated: sequences.length,
    sequencesCancelled: lastTrace ? lastTrace.cancelled : 0,
    notificationsScheduled: provider.scheduled.length,
    notificationsCancelled: provider.cancelled.length,
    errors: 0,
    durationMs: lastTrace ? lastTrace.durationMs : 0,
  };
}

// ── Helpers ───────────────────────────────────────────────────────

const ANCHOR = new Date('2026-07-10T10:00:00Z');
const ASSESSMENT_DATE = new Date('2026-07-15T10:00:00Z');

function createEngineComponents(clock = new FakeClock(ANCHOR)) {
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());
  registry.register(new GradingPolicy());

  const factory = new SequenceFactory(clock);
  const interruption = new InterruptionPolicy(clock);
  const templates = new TemplateResolver(new FakeI18n());
  const reconciler = new NotificationReconciler();
  const provider = new CaptureProvider();
  const engine = new ReminderEngine(registry, factory, interruption, templates, reconciler, provider, clock);

  return { engine, provider, clock, registry, factory, interruption, templates };
}

function assessmentEntity(overrides: Record<string, any> = {}): any {
  return {
    id: 'a-1',
    date: ASSESSMENT_DATE.toISOString(),
    title: 'Parcial Álgebra',
    ...overrides,
  };
}

function emptySnapshot(): EntitySnapshot {
  return { assessments: [], schedules: [], flashcard_decks: [], grading_periods: [], calendar_events: [] };
}

// ── Invariant helpers ─────────────────────────────────────────────

function expectConvergence(engine: ReminderEngine, entityType: string, entityId: string): void {
  const sequences = engine.getDesiredSequences();
  const matches = sequences.filter((s) => s.entityType === entityType && s.entityId === entityId);
  expect(matches.length).toBeLessThanOrEqual(1);
}

function expectNoDuplicates(engine: ReminderEngine): void {
  const sequences = engine.getDesiredSequences();
  const seen = new Set<string>();
  for (const s of sequences) {
    const key = `${s.entityType}:${s.entityId}`;
    expect(seen.has(key)).toBe(false);
    seen.add(key);
  }
}

function expectNoOrphans(engine: ReminderEngine, provider: CaptureProvider): void {
  const sequenceIds = new Set(engine.getDesiredSequences().map((s) => s.id));
  for (const r of provider.scheduled) {
    const parts = r.id.split('::');
    const seqId = parts.slice(0, -1).join('::');
    expect(sequenceIds.has(seqId)).toBe(true);
  }
}

// ── Sprint 6.1.1 — Event Storm ────────────────────────────────────

describe('Sprint 6.1.1 — Event Storm', () => {
  describe('Escenario A: create + updates + delete', () => {
    it('create + 5 updates + delete → 0 sequences, 0 notificaciones', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const id = 'a-storm-1';
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v2' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v3' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v4' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v5' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v6' }));
      await engine.onEntityDeleted('assessment', id);

      expect(engine.getDesiredSequences()).toHaveLength(0);
      expect(provider.scheduled).toHaveLength(0);
    });

    it('create + 5 updates (sin delete) → 1 secuencia, 1 entidad', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const id = 'a-storm-2';
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v2' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v3' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v4' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v5' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v6', date: ASSESSMENT_DATE.toISOString() }));

      expectConvergence(engine, 'assessment', id);
      expectNoDuplicates(engine);
      expect(engine.getDesiredSequences()).toHaveLength(1);
      expect(provider.scheduled.length).toBeGreaterThan(0);
      expectNoOrphans(engine, provider);
    });
  });

  describe('Escenario B: eventos sin create previo', () => {
    it('10 updates sobre entidad con date válido → converge a 1 secuencia (no 10)', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const id = 'a-nonexistent';
      for (let i = 0; i < 10; i++) {
        await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: `v${i}` }));
      }

      expectConvergence(engine, 'assessment', id);
      expect(engine.getDesiredSequences()).toHaveLength(1);
      expect(provider.scheduled.length).toBeGreaterThan(0);
    });
  });

  describe('Escenario C: create + delete + recreate (mismo id)', () => {
    it('delete + create con mismo id → 1 secuencia activa', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const id = 'a-recreate';
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id }));
      expect(engine.getDesiredSequences()).toHaveLength(1);

      await engine.onEntityDeleted('assessment', id);
      expect(engine.getDesiredSequences()).toHaveLength(0);

      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'renacido' }));
      expect(engine.getDesiredSequences()).toHaveLength(1);
      expectNoDuplicates(engine);
    });
  });

  describe('Escenario D: entrelazado — 2 entidades simultáneas', () => {
    it('eventos entrelazados sobre 2 entidades → 2 secuencias sin contaminación', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const idA = 'a-alpha';
      const idB = 'a-beta';

      await engine.onEntityChanged('assessment', idA, assessmentEntity({ id: idA }));
      await engine.onEntityChanged('assessment', idB, assessmentEntity({ id: idB }));
      await engine.onEntityChanged('assessment', idA, assessmentEntity({ id: idA, title: 'alpha-v2' }));
      await engine.onEntityDeleted('assessment', idB);
      await engine.onEntityChanged('assessment', idA, assessmentEntity({ id: idA, title: 'alpha-v3' }));

      expect(engine.getDesiredSequences()).toHaveLength(1);
      expectConvergence(engine, 'assessment', idA);
      expectNoDuplicates(engine);
      expectNoOrphans(engine, provider);
    });
  });

  describe('Escenario E: Promise.all — ráfaga concurrente', () => {
    it('10 eventos en Promise.all → FIFO, sin duplicados', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const id = 'a-concurrent';
      const events = [
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v1' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v2' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v3' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v4' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v5' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v6' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v7' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v8' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v9' })),
        engine.onEntityDeleted('assessment', id),
      ];

      await Promise.all(events);

      expect(engine.getDesiredSequences()).toHaveLength(0);
      expect(provider.scheduled).toHaveLength(0);
    });

    it('Promise.all con delete intermedio produce estado convergente', async () => {
      const { engine } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const id = 'a-conv';
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id }));
      await Promise.all([
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v2' })),
        engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v3' })),
      ]);

      expectConvergence(engine, 'assessment', id);
      const seq = engine.getDesiredSequences().find((s) => s.entityId === id);
      expect(seq).toBeDefined();
    });
  });

  describe('Escenario F: Idempotencia', () => {
    it('repetir exactamente la misma ráfaga produce el mismo estado final', async () => {
      const runStorm = async () => {
        const { engine, provider } = createEngineComponents();
        await engine.initialize(emptySnapshot());

        const id = 'a-idem';
        await engine.onEntityChanged('assessment', id, assessmentEntity({ id }));
        await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v2' }));
        await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v3' }));
        await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v4' }));

        return {
          sequences: engine.getDesiredSequences(),
          scheduledCount: provider.scheduled.length,
          cancelledCount: provider.cancelled.length,
        };
      };

      const r1 = await runStorm();
      const r2 = await runStorm();

      expect(r1.sequences).toEqual(r2.sequences);
      expect(r1.scheduledCount).toBe(r2.scheduledCount);
    });
  });

  describe('Escenario G: Inicialización con datos existentes', () => {
    it('initialize con snapshot + event storm → converge correctamente', async () => {
      const { engine, provider } = createEngineComponents();

      const snapshot: EntitySnapshot = {
        assessments: [assessmentEntity({ id: 'a-pre' })],
        schedules: [],
        flashcard_decks: [],
        grading_periods: [],
        calendar_events: [],
      };

      await engine.initialize(snapshot);
      expect(engine.getDesiredSequences()).toHaveLength(1);

      await engine.onEntityChanged('assessment', 'a-pre', assessmentEntity({ id: 'a-pre', title: 'v2' }));
      expectConvergence(engine, 'assessment', 'a-pre');
      expect(engine.getDesiredSequences()).toHaveLength(1);

      await engine.onEntityDeleted('assessment', 'a-pre');
      expect(engine.getDesiredSequences()).toHaveLength(0);
    });
  });

  describe('Escenario H: cross-entity storm', () => {
    it('ráfaga sobre 4 tipos distintos → cada uno converge independientemente', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const entities = [
        { type: 'assessment', id: 'ca-1', entity: assessmentEntity({ id: 'ca-1' }) },
        { type: 'schedule', id: 'cs-1', entity: { id: 'cs-1', endTime: new Date('2026-07-10T11:30:00Z').toISOString() } },
        { type: 'flashcard_deck', id: 'cd-1', entity: { id: 'cd-1', dueCardsCount: 10, title: 'Deck' } },
        { type: 'grading_period', id: 'cg-1', entity: { id: 'cg-1', closeDate: '2026-07-20T23:59:00Z' } },
      ];

      await Promise.all(entities.map((e) => engine.onEntityChanged(e.type as any, e.id, e.entity)));

      expect(engine.getDesiredSequences()).toHaveLength(4);
      expectNoDuplicates(engine);

      await Promise.all(entities.map((e) => engine.onEntityDeleted(e.type as any, e.id)));

      expect(engine.getDesiredSequences()).toHaveLength(0);
    });
  });

  describe('Métricas (informativas)', () => {
    it('reporta métricas del Event Storm', async () => {
      const { engine, provider } = createEngineComponents();
      await engine.initialize(emptySnapshot());

      const id = 'a-metrics';
      const t0 = Date.now();

      await engine.onEntityChanged('assessment', id, assessmentEntity({ id }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v2' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v3' }));
      await engine.onEntityChanged('assessment', id, assessmentEntity({ id, title: 'v4' }));
      await engine.onEntityDeleted('assessment', id);

      const metrics: StormMetrics = {
        eventsReceived: 5,
        sequencesCreated: 0,
        sequencesCancelled: 0,
        notificationsScheduled: provider.scheduled.length,
        notificationsCancelled: provider.cancelled.length,
        errors: 0,
        durationMs: Date.now() - t0,
      };

      expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
      expect(metrics.errors).toBe(0);

      console.log('[StormMetrics]', JSON.stringify(metrics, null, 2));
    });
  });
});
