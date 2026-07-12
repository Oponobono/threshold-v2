import { PolicyRegistry } from '../policies/PolicyRegistry';
import { AssessmentPolicy } from '../policies/AssessmentPolicy';
import { ClassPolicy } from '../policies/ClassPolicy';
import { ReviewPolicy } from '../policies/ReviewPolicy';
import { EventPolicy } from '../policies/EventPolicy';
import { GradingPolicy } from '../policies/GradingPolicy';
import { SequenceFactory } from '../SequenceFactory';
import { ReminderSnapshotAssembler } from '../ReminderSnapshotAssembler';
import { FakeClock } from '../Clock';
import { InterruptionPolicy } from '../InterruptionPolicy';
import { TemplateResolver } from '../TemplateResolver';
import { NotificationReconciler } from '../NotificationReconciler';
import { ReminderEngine } from '../ReminderEngine';
import type {
  NotificationProvider,
  ScheduledNotificationInfo,
} from '../NotificationProvider';
import type { ScheduledReminder, EngineTraceEntry } from '../types';
import type { I18nService } from '../I18nService';
import type { ReminderSourceSnapshot } from '../types';

// ── Fakes ──────────────────────────────────────────────────────────

class FakeI18n implements I18nService {
  translate(key: string, _params?: any): string {
    const map: Record<string, string> = {
      'entity.assessment': 'Examen',
      'entity.schedule': 'Clase',
      'entity.flashcard_deck': 'Mazo',
      'intentTitle.prepare_exam': 'Preparar {entity}',
      'intentTitle.attend_class': 'Asistir a {entity}',
      'intentTitle.review_cards': 'Repasar {entity}',
      'intentTitle.follow_up': 'Seguimiento',
      'intentBody.prepare_exam': 'Tu {entity} se acerca.',
      'intentBody.attend_class': 'Tu {entity} comienza.',
      'intentBody.review_cards': 'Tienes tarjetas de {entity}.',
      'intentBody.follow_up': 'Revisa.',
    };
    const template = map[key] ?? key;
    const entityName = _params?.entity ?? '';
    return template.replace('{entity}', entityName);
  }
}

class FakeProvider implements NotificationProvider {
  readonly scheduled: ScheduledReminder[] = [];
  readonly cancelled: string[] = [];

  async requestPermissions(): Promise<boolean> {
    return true;
  }
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
      const ids = this.scheduled.filter((r) => r.id.startsWith(prefix)).map((r) => r.id);
      this.cancelled.push(...ids);
      for (const id of ids) {
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

// ── Test infrastructure ───────────────────────────────────────────

const ANCHOR = new Date('2026-07-10T10:00:00Z');
const ASSESSMENT_DATE = new Date('2026-07-15T10:00:00Z');
const SCHEDULE_END = new Date('2026-07-10T11:30:00Z');

function createEngine(clock?: FakeClock): {
  engine: ReminderEngine;
  provider: FakeProvider;
  clock: FakeClock;
} {
  const c = clock ?? new FakeClock(ANCHOR);
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());
  registry.register(new GradingPolicy());

  const provider = new FakeProvider();
  const engine = new ReminderEngine(
    registry,
    new SequenceFactory(c, new ReminderSnapshotAssembler()),
    new InterruptionPolicy(c),
    new TemplateResolver(new FakeI18n()),
    new NotificationReconciler(),
    provider,
    c,
  );

  return { engine, provider, clock: c };
}

const SNAPSHOT: ReminderSourceSnapshot = {
  assessments: [{ id: 'a-1', date: ASSESSMENT_DATE.toISOString(), status: 'active' }],
  schedules: [{ id: 's-1', endTime: SCHEDULE_END.toISOString(), status: 'active' }],
  flashcard_decks: [{ id: 'd-1', dueCardsCount: 5, status: 'active' }],
};

// ── Tests ─────────────────────────────────────────────────────────

describe('ReminderEngine', () => {

  describe('initialize()', () => {
    it('construye secuencias desde el snapshot y programa notificaciones', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      const seqs = engine.getDesiredSequences();
      expect(seqs.length).toBe(3);
      expect(seqs.map((s) => s.entityType).sort()).toEqual([
        'assessment',
        'flashcard_deck',
        'schedule',
      ]);

      expect(provider.scheduled.length).toBeGreaterThan(0);
      expect(provider.cancelled).toHaveLength(0);
    });

    it('entidad sin policies registradas se ignora silenciosamente', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize({
        ...SNAPSHOT,
        // @ts-expect-error unknown entityType not in registry
        unknown_entities: [{ id: 'x-1' }],
      });

      // Solo las 3 entidades conocidas
      expect(engine.getDesiredSequences().length).toBe(3);
    });

    it('snapshot vacio produce 0 secuencias y 0 notificaciones', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize({});

      expect(engine.getDesiredSequences()).toHaveLength(0);
      expect(provider.scheduled).toHaveLength(0);
    });
  });

  describe('onEntityChanged()', () => {
    it('agrega nueva secuencia y programa notificaciones', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize({});

      await engine.onEntityChanged('assessment', 'a-1', {
        id: 'a-1',
        date: ASSESSMENT_DATE.toISOString(),
        status: 'active',
      });

      expect(engine.getDesiredSequences()).toHaveLength(1);
      expect(provider.scheduled.length).toBeGreaterThan(0);
    });

    it('reemplaza secuencia existente para el mismo id', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      const beforeSeqs = engine.getDesiredSequences().length;

      // Cambiar la fecha del assessment (ID no cambia porque es determinista)
      const newDate = new Date(ASSESSMENT_DATE.getTime() + 86400000).toISOString();
      await engine.onEntityChanged('assessment', 'a-1', {
        id: 'a-1',
        date: newDate,
        status: 'active',
      });

      // Las secuencias no aumentan (misma entidad, reemplazada)
      expect(engine.getDesiredSequences()).toHaveLength(beforeSeqs);

      // El ID de la secuencia se mantiene (assessment::a-1)
      expect(engine.getDesiredSequences().map((s) => s.id)).toContain('assessment::a-1');
    });
  });

  describe('onEntityDeleted()', () => {
    it('elimina la secuencia y cancela notificaciones del assessment', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      const seqCount = engine.getDesiredSequences().length;

      await engine.onEntityDeleted('assessment', 'a-1');

      expect(engine.getDesiredSequences()).toHaveLength(seqCount - 1);
      // Las notificaciones del assessment se cancelaron (al menos 1)
      expect(provider.cancelled.length).toBeGreaterThan(0);
    });

    it('no falla si la entidad no existe', async () => {
      const { engine } = createEngine();
      await engine.initialize(SNAPSHOT);

      await expect(
        engine.onEntityDeleted('nonexistent', 'x-99'),
      ).resolves.toBeUndefined();
    });
  });

  describe('onActionCompleted()', () => {
    it('elimina la secuencia y cancela notificaciones restantes', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      const scheduledCount = provider.scheduled.length;

      await engine.onActionCompleted('schedule', 's-1');

      expect(engine.getDesiredSequences()).toHaveLength(2);
      expect(provider.cancelled.length).toBeGreaterThan(0);
    });
  });

  describe('onReminderTapped()', () => {
    it('es sincrono y no modifica estado', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      const seqsBefore = engine.getDesiredSequences();
      const scheduledBefore = provider.scheduled.length;

      const result = engine.onReminderTapped('some-reminder-id');

      expect(result).toBeUndefined();
      expect(engine.getDesiredSequences()).toEqual(seqsBefore);
      expect(provider.scheduled.length).toBe(scheduledBefore);
    });
  });

  describe('cancelAll()', () => {
    it('elimina todas las secuencias y cancela todas las notificaciones', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      expect(engine.getDesiredSequences().length).toBeGreaterThan(0);
      expect(provider.scheduled.length).toBeGreaterThan(0);

      await engine.cancelAll();

      expect(engine.getDesiredSequences()).toHaveLength(0);
      expect(provider.scheduled).toHaveLength(0);
    });
  });

  describe('FIFO queue', () => {
    it('procesa eventos en orden: add A, add B, delete A → solo B', async () => {
      const { engine } = createEngine();
      await engine.initialize({});

      // Cada await espera a que ese evento especifico se procese
      await engine.onEntityChanged('assessment', 'a-1', {
        id: 'a-1', date: ASSESSMENT_DATE.toISOString(), status: 'active',
      });
      expect(engine.getDesiredSequences()).toHaveLength(1);

      await engine.onEntityChanged('schedule', 's-1', {
        id: 's-1', endTime: SCHEDULE_END.toISOString(), status: 'active',
      });
      expect(engine.getDesiredSequences()).toHaveLength(2);

      await engine.onEntityDeleted('assessment', 'a-1');
      expect(engine.getDesiredSequences()).toHaveLength(1);

      const seqs = engine.getDesiredSequences();
      expect(seqs[0].entityType).toBe('schedule');
    });
  });

  describe('destroy()', () => {
    it('limpia estado interno', async () => {
      const { engine } = createEngine();
      await engine.initialize(SNAPSHOT);

      expect(engine.getDesiredSequences().length).toBeGreaterThan(0);

      engine.destroy();

      expect(engine.getDesiredSequences()).toHaveLength(0);
    });

    it('rechaza eventos posteriores', async () => {
      const { engine } = createEngine();
      await engine.initialize({});

      engine.destroy();

      await expect(
        engine.onEntityChanged('assessment', 'a-1', {
          id: 'a-1', date: ASSESSMENT_DATE.toISOString(), status: 'active',
        }),
      ).rejects.toThrow('Engine destroyed');
    });
  });

  describe('idempotencia', () => {
    it('initialize() × 2 produce exactamente el mismo estado', async () => {
      const { engine, provider } = createEngine();

      await engine.initialize(SNAPSHOT);
      const seqs1 = engine.getDesiredSequences();
      const scheduled1 = [...provider.scheduled];
      const cancelled1 = [...provider.cancelled];

      await engine.initialize(SNAPSHOT);
      const seqs2 = engine.getDesiredSequences();
      const scheduled2 = [...provider.scheduled];
      const cancelled2 = [...provider.cancelled];

      expect(seqs2).toEqual(seqs1);
      expect(scheduled2).toEqual(scheduled1);
      expect(cancelled2).toEqual(cancelled1);
    });

    it('initialize() × 3 no altera el estado', async () => {
      const { engine, provider } = createEngine();

      await engine.initialize(SNAPSHOT);
      const baselineSeqs = engine.getDesiredSequences();
      const baselineScheduled = provider.scheduled.length;

      await engine.initialize(SNAPSHOT);
      await engine.initialize(SNAPSHOT);

      expect(engine.getDesiredSequences()).toEqual(baselineSeqs);
      expect(provider.scheduled.length).toBe(baselineScheduled);
    });

    it('onEntityChanged() mismo payload × 2 no duplica notificaciones', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize({});

      await engine.onEntityChanged('assessment', 'a-1', {
        id: 'a-1', date: ASSESSMENT_DATE.toISOString(), status: 'active',
      });
      const scheduledAfterFirst = provider.scheduled.length;

      await engine.onEntityChanged('assessment', 'a-1', {
        id: 'a-1', date: ASSESSMENT_DATE.toISOString(), status: 'active',
      });

      expect(engine.getDesiredSequences()).toHaveLength(1);
      expect(provider.scheduled.length).toBe(scheduledAfterFirst);
      // No hubo cancelaciones porque los IDs son los mismos
    });

    it('onEnvironmentChanged() × 2 no modifica secuencias ni notificaciones', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      const seqsBefore = engine.getDesiredSequences();
      const scheduledBefore = provider.scheduled.length;

      await engine.onEnvironmentChanged({ timezone: 'America/Mexico_City' });
      await engine.onEnvironmentChanged({ timezone: 'America/Mexico_City' });

      expect(engine.getDesiredSequences()).toEqual(seqsBefore);
      expect(provider.scheduled.length).toBe(scheduledBefore);
    });

    it('cancelAll() × 2 es seguro', async () => {
      const { engine, provider } = createEngine();
      await engine.initialize(SNAPSHOT);

      await engine.cancelAll();
      expect(engine.getDesiredSequences()).toHaveLength(0);
      expect(provider.scheduled).toHaveLength(0);

      await engine.cancelAll();
      expect(engine.getDesiredSequences()).toHaveLength(0);
      expect(provider.scheduled).toHaveLength(0);
    });

    it('destroy() × 2 es seguro', async () => {
      const { engine } = createEngine();
      engine.destroy();
      expect(() => engine.destroy()).not.toThrow();
    });

    it('Promise.all con 3 onEntityChanged mantiene orden FIFO y estado final correcto', async () => {
      const { engine } = createEngine();
      await engine.initialize({});

      await Promise.all([
        engine.onEntityChanged('assessment', 'a-1', {
          id: 'a-1', date: ASSESSMENT_DATE.toISOString(), status: 'active',
        }),
        engine.onEntityChanged('schedule', 's-1', {
          id: 's-1', endTime: SCHEDULE_END.toISOString(), status: 'active',
        }),
        engine.onEntityDeleted('assessment', 'a-1'),
      ]);

      // FIFO: add assessment → add schedule → delete assessment
      // Resultado final: solo schedule
      const seqs = engine.getDesiredSequences();
      expect(seqs).toHaveLength(1);
      expect(seqs[0].entityType).toBe('schedule');
    });
  });

  describe('observabilidad', () => {
    it('initialize() produce una entrada de traza', async () => {
      const { engine } = createEngine();
      await engine.initialize(SNAPSHOT);

      const trace = engine.getTraceLog();
      expect(trace.length).toBeGreaterThanOrEqual(1);
      expect(trace[0].eventType).toBe('initialize');
      expect(trace[0].sequences).toBe(3);
      expect(trace[0].timestamp).toBeInstanceOf(Date);
      expect(typeof trace[0].durationMs).toBe('number');
    });

    it('cada evento produce una entrada de traza con scheduled/cancelled', async () => {
      const { engine } = createEngine();
      await engine.initialize({});

      await engine.onEntityChanged('assessment', 'a-1', {
        id: 'a-1', date: ASSESSMENT_DATE.toISOString(), status: 'active',
      });
      await engine.onEntityDeleted('assessment', 'a-1');

      const trace = engine.getTraceLog();
      const changed = trace.find((t) => t.eventType === 'entity_changed');
      const deleted = trace.find((t) => t.eventType === 'entity_deleted');

      expect(changed).toBeDefined();
      expect(changed!.scheduled).toBeGreaterThan(0);
      expect(changed!.cancelled).toBe(0);

      expect(deleted).toBeDefined();
      expect(deleted!.cancelled).toBeGreaterThan(0);
    });

    it('cancelAll() produce traza con eventType cancel_all', async () => {
      const { engine } = createEngine();
      await engine.initialize(SNAPSHOT);
      await engine.cancelAll();

      const trace = engine.getTraceLog();
      const cancelEntry = trace.find((t) => t.eventType === 'cancel_all');
      expect(cancelEntry).toBeDefined();
      expect(cancelEntry!.sequences).toBe(0);
    });

    it('clearTraceLog() vacia el buffer', async () => {
      const { engine } = createEngine();
      await engine.initialize(SNAPSHOT);
      expect(engine.getTraceLog().length).toBeGreaterThan(0);

      engine.clearTraceLog();
      expect(engine.getTraceLog()).toHaveLength(0);
    });

    it('buffer circular no excede MAX_TRACE_SIZE', async () => {
      const { engine } = createEngine();
      // Generar mas de 200 trazas
      for (let i = 0; i < 250; i++) {
        await engine.onEnvironmentChanged({ timezone: 'UTC' });
      }

      const trace = engine.getTraceLog();
      expect(trace.length).toBeLessThanOrEqual(200);
      // Las mas recientes deben ser environment_changed
      expect(trace.every((t) => t.eventType === 'environment_changed')).toBe(true);
    });
  });
});
