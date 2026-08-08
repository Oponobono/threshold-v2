import { PolicyRegistry } from '../policies/PolicyRegistry';
import { AssessmentPolicy } from '../policies/AssessmentPolicy';
import { ClassPolicy } from '../policies/ClassPolicy';
import { ReviewPolicy } from '../policies/ReviewPolicy';
import { EventPolicy } from '../policies/EventPolicy';
import { SequenceFactory } from '../SequenceFactory';
import { ReminderSnapshotAssembler } from '../ReminderSnapshotAssembler';
import { FakeClock } from '../Clock';
import { InterruptionPolicy } from '../InterruptionPolicy';
import { TemplateResolver } from '../TemplateResolver';
import { NotificationReconciler } from '../NotificationReconciler';
import { ReminderEngine } from '../ReminderEngine';
import { ReminderPreferencesService } from '../ReminderPreferencesService';
import type { KeyValueStore } from '../ReminderPreferencesService';
import type { ReminderPreferences } from '../ReminderPreferences';
import type {
  NotificationProvider,
  ScheduledNotificationInfo,
} from '../NotificationProvider';
import type { ScheduledReminder, ReminderSourceSnapshot } from '../types';
import type { I18nService } from '../I18nService';

// ── Fakes (mismas convenciones que ReminderEngine.Wiring.test.ts) ───────

class FakeI18n implements I18nService {
  translate(key: string, _params?: any): string {
    const map: Record<string, string> = {
      'entity.schedule': 'Clase',
      'entity.assessment': 'Examen',
      'intentTitle.attend_class': 'Asistir a {entity}',
      'intentBody.attend_class': 'Tu {entity} comienza.',
      'intentTitle.prepare_exam': 'Preparar {entity}',
      'intentBody.prepare_exam': 'Tu {entity} se acerca.',
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
  setForegroundHandler(_handler: any): void {}
  async schedule(reminder: ScheduledReminder): Promise<string> {
    this.scheduled.push(reminder);
    return reminder.id;
  }
  async cancel(id: string): Promise<void> {
    const idx = this.scheduled.findIndex((r) => r.id === id);
    if (idx >= 0) this.scheduled.splice(idx, 1);
    this.cancelled.push(id);
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
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getString(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

// ── Construcción del engine (preferencias mutables vía servicio real) ────

// Miércoles 8 Jul 2026 10:00 local. Clase lunes (dow=1) 08:00 → lunes 13 Jul.
const ANCHOR = new Date(2026, 6, 8, 10, 0, 0, 0);

function buildCore(): { clock: FakeClock; provider: FakeProvider } {
  return { clock: new FakeClock(ANCHOR), provider: new FakeProvider() };
}

function createEngine(
  prefsProvider: () => ReminderPreferences,
  core = buildCore(),
): { engine: ReminderEngine; core: typeof core } {
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());

  const engine = new ReminderEngine(
    registry,
    new SequenceFactory(core.clock, new ReminderSnapshotAssembler()),
    new InterruptionPolicy(core.clock),
    new TemplateResolver(new FakeI18n()),
    new NotificationReconciler(),
    core.provider,
    core.clock,
    prefsProvider,
  );

  return { engine, core };
}

const CLASS = {
  subject_id: 'subj-1',
  day_of_week: 1,
  start_time: '08:00',
  end_time: '09:00',
  status: 'active',
};

function scheduleRow(id: string, overrides: Record<string, any> = {}) {
  return { id, ...CLASS, ...overrides };
}

function assessmentRow(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    subject_id: 'subj-1',
    assessment_type: 'exam',
    starts_at: '2026-07-22T10:00:00Z',
    status: 'active',
    ...overrides,
  };
}

function deckRow(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    subject_id: 'subj-1',
    dueCardsCount: 5,
    card_count: 5,
    status: 'active',
    ...overrides,
  };
}

function calendarEventRow(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    subject_id: 'subj-1',
    status: 'active',
    ...overrides,
  };
}

function snapshot(
  rows: readonly any[],
  extra: {
    assessments?: readonly any[];
    decks?: readonly any[];
    calendarEvents?: readonly any[];
  } = {},
): ReminderSourceSnapshot {
  return {
    schedules: rows,
    assessments: extra.assessments ?? [],
    flashcard_decks: extra.decks ?? [],
    calendar_events: extra.calendarEvents ?? [],
  };
}

function stateOf(provider: FakeProvider) {
  return {
    ids: provider.scheduled.map((r) => r.id).sort(),
    times: provider.scheduled.map((r) => r.scheduledAt.getTime()).sort((a, b) => a - b),
  };
}

// Invariante central: el estado del OS es EXACTAMENTE el plan que el engine
// cree que debe programar. Sin missing, sin orphans, sin duplicados.
async function assertConverged(
  engine: ReminderEngine,
  provider: FakeProvider,
): Promise<void> {
  const plan = await engine.computeCurrentPlan();
  const planIds = plan.deliverables.map((d) => d.id).sort();
  const planTimes = plan.deliverables
    .map((d) => d.scheduledAt.getTime())
    .sort((a, b) => a - b);
  const osIds = provider.scheduled.map((r) => r.id).sort();
  const osTimes = provider.scheduled.map((r) => r.scheduledAt.getTime()).sort((a, b) => a - b);
  expect(osIds).toEqual(planIds);
  expect(osTimes).toEqual(planTimes);
}

describe('FULL REGRESSION — preferencias → pipeline → engine → reconciler → OS', () => {
  describe('Cold start', () => {
    it('initialize desde OS vacío → el SO termina con exactamente el plan esperado', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      // 3 filas duplicadas de la misma clase lógica + 1 clase distinta (martes).
      const rows = [
        scheduleRow('s-1'),
        scheduleRow('s-2'),
        scheduleRow('s-3'),
        scheduleRow('s-4', { subject_id: 'subj-b', day_of_week: 2 }),
      ];
      await engine.initialize(snapshot(rows));

      // 2 sesiones lógicas → 2 notificaciones (no 12 por duplicados físicos).
      expect(core.provider.scheduled).toHaveLength(2);
      expect(core.provider.cancelled).toHaveLength(0);

      const times = stateOf(core.provider).times;
      expect(times).toEqual([
        new Date(2026, 6, 13, 7, 45, 0, 0).getTime(), // lunes 08:00 − 15 min
        new Date(2026, 6, 14, 7, 45, 0, 0).getTime(), // martes 08:00 − 15 min
      ]);

      await assertConverged(engine, core.provider);
    });
  });

  describe('Offline', () => {
    it('delta + cambio de preferencias + cierre/reapertura sin red → el scheduler converge', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const core = buildCore();
      let engine = createEngine(() => service.get(), core).engine;

      // Arranque con 1 clase.
      const rows1 = [scheduleRow('s-1')];
      await engine.initialize(snapshot(rows1));
      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 13, 7, 45, 0, 0));

      // Delta "offline": se crea una clase nueva vía evento (sin red, sin re-init).
      await engine.onEntityChanged(
        'schedule',
        's-2',
        scheduleRow('s-2', { subject_id: 'subj-b', day_of_week: 2 }),
      );
      expect(core.provider.scheduled).toHaveLength(2);

      // Cambio de preferencias "offline" (Settings, sin red): offset global 45.
      service.set({ defaultOffset: 45 });
      // Re-initialize con el snapshot actualizado (cold start con los 2 rows).
      engine = createEngine(() => service.get(), core).engine;
      await engine.initialize(snapshot([scheduleRow('s-1'), scheduleRow('s-2', { subject_id: 'subj-b', day_of_week: 2 })]));

      // El estado reconstruido por snapshot es idéntico al construido por delta.
      expect(stateOf(core.provider).times).toEqual([
        new Date(2026, 6, 13, 7, 15, 0, 0).getTime(),
        new Date(2026, 6, 14, 7, 15, 0, 0).getTime(),
      ]);
      await assertConverged(engine, core.provider);
    });
  });

  describe('Duplicados físicos → sesión lógica', () => {
    it('A,A,A → 1 notificación en el OS; reconciliaciones repetidas sin churn', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());
      const rows = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];

      await engine.initialize(snapshot(rows));
      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.scheduled[0].id).toMatch(/^schedule::logical::/);
      expect(core.provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 13, 7, 45, 0, 0));
      expect(core.provider.cancelled).toHaveLength(0);

      // 3 reconciliaciones más sobre el mismo estado → idéntico, cero churn.
      for (let i = 0; i < 3; i++) {
        await engine.initialize(snapshot(rows));
        expect(core.provider.scheduled).toHaveLength(1);
        expect(core.provider.cancelled).toHaveLength(0);
        await assertConverged(engine, core.provider);
      }
    });
  });

  describe('Cambio de preferencias en runtime', () => {
    it('offset 15→30: cancela la anterior y agenda la nueva sin residuo ni duplicados', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(snapshot([scheduleRow('s-1')]));
      const old = core.provider.scheduled[0];
      expect(old.scheduledAt).toEqual(new Date(2026, 6, 13, 7, 45, 0, 0));

      // El usuario cambia el offset de la categoría schedule a 30.
      service.set({ categories: { schedule: { offsets: [30] } } });
      await engine.initialize(snapshot([scheduleRow('s-1')]));

      // Reemplazo exacto: 1 en el OS, con el nuevo tiempo; el viejo fue cancelado.
      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 13, 7, 30, 0, 0));
      expect(core.provider.cancelled).toContain(old.id);
      expect(core.provider.scheduled.filter((r) => r.id === old.id)).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });

    it('categoría schedule deshabilitada → el OS converge a cero para clase; assessments intactos', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([scheduleRow('s-1')], { assessments: [assessmentRow('a-1')] }),
      );
      expect(core.provider.scheduled).toHaveLength(6); // 1 clase + 5 assessment

      service.set({ categories: { schedule: { enabled: false } } });
      await engine.initialize(
        snapshot([scheduleRow('s-1')], { assessments: [assessmentRow('a-1')] }),
      );

      expect(core.provider.scheduled.some((r) => r.id.startsWith('schedule::'))).toBe(false);
      expect(core.provider.scheduled).toHaveLength(5);
      await assertConverged(engine, core.provider);
    });

    it('master switch notificationsEnabled=false → plan vacío y el OS converge a cero', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([scheduleRow('s-1')], { assessments: [assessmentRow('a-1')] }),
      );
      const prevIds = stateOf(core.provider).ids;
      expect(prevIds.length).toBe(6);

      service.set({ notificationsEnabled: false });
      await engine.initialize(
        snapshot([scheduleRow('s-1')], { assessments: [assessmentRow('a-1')] }),
      );

      expect(core.provider.scheduled).toHaveLength(0);
      expect(core.provider.cancelled).toEqual(expect.arrayContaining(prevIds));
      await assertConverged(engine, core.provider);
    });
  });

  describe('Quiet hours', () => {
    it('scheduledAt dentro de la ventana → omitido (no desplazado); fuera → programado', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      service.set({ quietHours: { enabled: true, start: '22:30', end: '07:00' } });
      const { engine, core } = createEngine(() => service.get());

      // Miércoles 07:00 − 15 min = 06:45 (dentro de la ventana → omitido).
      // Miércoles 09:00 − 15 min = 08:45 (fuera → programado).
      const rows = [
        scheduleRow('s-1', { day_of_week: 3, start_time: '07:00', end_time: '08:00' }),
        scheduleRow('s-2', { day_of_week: 3, start_time: '09:00', end_time: '10:00' }),
      ];
      await engine.initialize(snapshot(rows));

      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 15, 8, 45, 0, 0));
      await assertConverged(engine, core.provider);
    });
  });

  describe('Reset de preferencias', () => {
    it('preferencias custom → reset() → DEFAULT_PREFERENCES y el OS reconverge', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());

      // Custom: offset global 60, schedule deshabilitada.
      service.set({
        defaultOffset: 60,
        categories: { schedule: { enabled: false, offsets: [90] } },
      });
      const core = buildCore();
      let engine = createEngine(() => service.get(), core).engine;
      await engine.initialize(
        snapshot([scheduleRow('s-1')], { assessments: [assessmentRow('a-1')] }),
      );
      expect(core.provider.scheduled.some((r) => r.id.startsWith('schedule::'))).toBe(false);
      expect(core.provider.scheduled).toHaveLength(5); // 5 assessments (policy)

      // Reset → defaults: schedule re-habilitada, offset 15 heredado del global.
      service.reset();
      engine = createEngine(() => service.get(), core).engine;
      await engine.initialize(
        snapshot([scheduleRow('s-1')], { assessments: [assessmentRow('a-1')] }),
      );

      expect(core.provider.scheduled).toHaveLength(6);
      const cls = core.provider.scheduled.find((r) => r.id.startsWith('schedule::'));
      expect(cls?.scheduledAt).toEqual(new Date(2026, 6, 13, 7, 45, 0, 0));
      await assertConverged(engine, core.provider);
    });
  });

  describe('Resiliencia E2E', () => {
    it('A,A,A → 1 OS; sobrevive edición offline, reinicios y reconciliaciones múltiples sin churn', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const core = buildCore();
      const rows = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];

      let engine = createEngine(() => service.get(), core).engine;
      await engine.initialize(snapshot(rows));
      expect(core.provider.scheduled).toHaveLength(1);

      // Edición "offline" de un campo cosmético (color) sobre una fila duplicada:
      // la sesión lógica no cambia → sigue 1 notificación, cero canciones.
      await engine.onEntityChanged('schedule', 's-1', scheduleRow('s-1', { color: '#FF0000' }));
      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.cancelled).toHaveLength(0);
      await assertConverged(engine, core.provider);

      // "Reinicio" x2: el engine se destruye y se recrea, pero el OS conserva
      // lo agendado → el nuevo engine reconcilia sin churn.
      for (let i = 0; i < 2; i++) {
        engine.destroy();
        engine = createEngine(() => service.get(), core).engine;
        await engine.initialize(snapshot(rows));
        expect(core.provider.scheduled).toHaveLength(1);
        expect(core.provider.cancelled).toHaveLength(0);
        await assertConverged(engine, core.provider);
      }

      // 5 reconciliaciones adicionales → idéntico, cero churn.
      for (let i = 0; i < 5; i++) {
        await engine.initialize(snapshot(rows));
        expect(core.provider.scheduled).toHaveLength(1);
        expect(core.provider.cancelled).toHaveLength(0);
      }
      await assertConverged(engine, core.provider);
    });
  });

  describe('FSRS agregado diario (flashcard_deck)', () => {
    it('N decks con tarjetas por repasar → EXACTAMENTE N notificaciones (1 por deck, identidad ::daily)', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      // ANCHOR = miércoles 8 Jul 10:00 local; checkTime default 19:00 → hoy 19:00.
      // 3 decks simultáneos → _resolveGroup los separa +5min: 19:00/19:05/19:10.
      const decks = [
        deckRow('d-1', { dueCardsCount: 10 }),
        deckRow('d-2', { dueCardsCount: 3 }),
        deckRow('d-3', { dueCardsCount: 1 }),
      ];
      await engine.initialize(snapshot([], { decks }));

      expect(core.provider.scheduled).toHaveLength(3);
      const ids = core.provider.scheduled.map((r) => r.id).sort();
      expect(ids).toEqual([
        'flashcard_deck::d-1::daily::0',
        'flashcard_deck::d-2::daily::0',
        'flashcard_deck::d-3::daily::0',
      ]);
      expect(stateOf(core.provider).times).toEqual([
        new Date(2026, 6, 8, 19, 0, 0, 0).getTime(),
        new Date(2026, 6, 8, 19, 5, 0, 0).getTime(),
        new Date(2026, 6, 8, 19, 10, 0, 0).getTime(),
      ]);
      await assertConverged(engine, core.provider);
    });

    it('mazo sin tarjetas por repasar (card_count=0) → 0 notificaciones', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], { decks: [deckRow('d-0', { dueCardsCount: 0, card_count: 0 })] }),
      );

      expect(core.provider.scheduled).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });

    it('checkTime configurable (08:00) → el recordatorio nace a esa hora, no a 19:00', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      service.set({ categories: { flashcard_deck: { checkTime: '08:00' } } });
      const { engine, core } = createEngine(() => service.get());

      // ANCHOR 10:00 local > 08:00 → mañana 09 Jul 08:00.
      await engine.initialize(snapshot([], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }));

      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 9, 8, 0, 0, 0));
      await assertConverged(engine, core.provider);
    });

    it('cambio de checkTime 19:00→08:00 → cancela la anterior y agenda la nueva sin residuo ni duplicados', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(snapshot([], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }));
      const old = core.provider.scheduled[0];
      expect(old.scheduledAt).toEqual(new Date(2026, 6, 8, 19, 0, 0, 0));

      service.set({ categories: { flashcard_deck: { checkTime: '08:00' } } });
      await engine.initialize(snapshot([], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }));

      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.scheduled[0].id).toBe(old.id);
      expect(core.provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 9, 8, 0, 0, 0));
      expect(core.provider.cancelled).toContain(old.id);
      await assertConverged(engine, core.provider);
    });

    it('evento de mazo (onEntityChanged) → resync → exactamente 1; edición cosmética no duplica', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(snapshot([], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }));
      expect(core.provider.scheduled).toHaveLength(1);

      // Edición "offline" cosmética: sigue 1, cero churn.
      await engine.onEntityChanged(
        'flashcard_deck',
        'd-1',
        deckRow('d-1', { dueCardsCount: 5, color: '#FF0000' }),
      );
      expect(core.provider.scheduled).toHaveLength(1);
      expect(core.provider.cancelled).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });

    it('desaparición de tarjetas por repasar (due 5→0) → el recordatorio diario se cancela', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(snapshot([], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }));
      expect(core.provider.scheduled).toHaveLength(1);

      await engine.onEntityChanged(
        'flashcard_deck',
        'd-1',
        deckRow('d-1', { dueCardsCount: 0, card_count: 0 }),
      );
      expect(core.provider.scheduled).toHaveLength(0);
      expect(core.provider.cancelled).toContain('flashcard_deck::d-1::daily::0');
      await assertConverged(engine, core.provider);
    });

    it('mazo eliminado (onEntityDeleted) → el recordatorio diario se cancela', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(snapshot([], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }));
      expect(core.provider.scheduled).toHaveLength(1);

      await engine.onEntityDeleted('flashcard_deck', 'd-1');
      expect(core.provider.scheduled).toHaveLength(0);
      expect(core.provider.cancelled).toContain('flashcard_deck::d-1::daily::0');
      await assertConverged(engine, core.provider);
    });

    it('action_completed en mazo → se completa el repaso diario y el OS cancela', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(snapshot([], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }));
      expect(core.provider.scheduled).toHaveLength(1);

      await engine.onActionCompleted('flashcard_deck', 'd-1');
      expect(core.provider.scheduled).toHaveLength(0);
      expect(core.provider.cancelled).toContain('flashcard_deck::d-1::daily::0');
      await assertConverged(engine, core.provider);
    });

    it('categoría flashcard_deck deshabilitada → el OS converge a cero para repasos; schedule intacto', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([scheduleRow('s-1')], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }),
      );
      expect(core.provider.scheduled).toHaveLength(2); // 1 clase + 1 repaso

      service.set({ categories: { flashcard_deck: { enabled: false } } });
      await engine.initialize(
        snapshot([scheduleRow('s-1')], { decks: [deckRow('d-1', { dueCardsCount: 5 })] }),
      );

      expect(core.provider.scheduled.some((r) => r.id.startsWith('flashcard_deck::'))).toBe(false);
      expect(core.provider.scheduled).toHaveLength(1);
      await assertConverged(engine, core.provider);
    });
  });

  describe('Assessment — contrato de ancla (exam→starts_at, deadline→due_at, sin ancla→nada)', () => {
    it('exam con starts_at → 5 recordatorios anclados a starts_at', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], {
          assessments: [
            assessmentRow('a-exam', { assessment_type: 'exam', starts_at: '2026-07-22T10:00:00Z' }),
          ],
        }),
      );

      expect(core.provider.scheduled).toHaveLength(5);
      await assertConverged(engine, core.provider);
    });

    it('deadline con due_at → 5 recordatorios anclados a due_at', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], {
          assessments: [
            assessmentRow('a-dl', { assessment_type: 'deadline', due_at: '2026-07-22T10:00:00Z' }),
          ],
        }),
      );

      expect(core.provider.scheduled).toHaveLength(5);
      await assertConverged(engine, core.provider);
    });

    it('exam sin ancla (starts_at ausente) → 0 recordatorios (sin fallback a date)', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], {
          assessments: [assessmentRow('a-na', { assessment_type: 'exam', starts_at: undefined })],
        }),
      );

      expect(core.provider.scheduled).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });

    it('deadline sin due_at → 0 recordatorios', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], {
          assessments: [assessmentRow('a-dna', { assessment_type: 'deadline', due_at: undefined })],
        }),
      );

      expect(core.provider.scheduled).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });

    it('cambio de ancla deadline→exam en runtime → reschedule sin duplicados', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], {
          assessments: [
            assessmentRow('a-1', { assessment_type: 'deadline', due_at: '2026-07-22T10:00:00Z' }),
          ],
        }),
      );
      expect(core.provider.scheduled).toHaveLength(5);
      const oldTimes = stateOf(core.provider).times;
      const oldIds = core.provider.scheduled.map((r) => r.id).sort();

      await engine.onEntityChanged(
        'assessment',
        'a-1',
        assessmentRow('a-1', { assessment_type: 'exam', starts_at: '2026-07-20T08:00:00Z' }),
      );

      // El ancla cambió → la misma identidad se REAGENDA (mismos ids, nuevos tiempos).
      expect(core.provider.scheduled).toHaveLength(5);
      expect(core.provider.scheduled.map((r) => r.id).sort()).toEqual(oldIds);
      expect(stateOf(core.provider).times).not.toEqual(oldTimes);
      expect(core.provider.cancelled.length).toBeGreaterThan(0);
      await assertConverged(engine, core.provider);
    });
  });

  describe('Calendar event — timed genera, all-day no', () => {
    it('evento timed (start_date con hora) → 2 recordatorios [−60, 0]', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], { calendarEvents: [calendarEventRow('ev-1', { start_date: '2026-07-10T09:00:00Z' })] }),
      );

      expect(core.provider.scheduled).toHaveLength(2);
      const base = new Date('2026-07-10T09:00:00Z').getTime();
      expect(stateOf(core.provider).times).toEqual([base - 3600000, base]); // offset::60 y offset::0
      await assertConverged(engine, core.provider);
    });

    it('evento all-day → 0 recordatorios', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], { calendarEvents: [calendarEventRow('ev-2', { is_all_day: 1 })] }),
      );

      expect(core.provider.scheduled).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });

    it('cambio timed→all-day en runtime → el OS converge a cero', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([], { calendarEvents: [calendarEventRow('ev-1', { start_date: '2026-07-10T09:00:00Z' })] }),
      );
      expect(core.provider.scheduled).toHaveLength(2);

      await engine.onEntityChanged('calendar_event', 'ev-1', calendarEventRow('ev-1', { is_all_day: 1 }));
      expect(core.provider.scheduled).toHaveLength(0);
      expect(core.provider.cancelled).toHaveLength(2);
      await assertConverged(engine, core.provider);
    });
  });

  describe('Matriz v1.1 combinada', () => {
    it('todo el dominio a la vez: 2 clases + exam + deadline + sin-ancla + deck con due + deck vacío + timed + all-day', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const { engine, core } = createEngine(() => service.get());

      await engine.initialize(
        snapshot([scheduleRow('s-1'), scheduleRow('s-4', { subject_id: 'subj-b', day_of_week: 2 })], {
          assessments: [
            assessmentRow('a-exam', { assessment_type: 'exam', starts_at: '2026-07-22T10:00:00Z' }),
            assessmentRow('a-dl', { assessment_type: 'deadline', due_at: '2026-07-22T10:00:00Z' }),
            assessmentRow('a-na', { assessment_type: 'exam', starts_at: undefined }),
          ],
          decks: [deckRow('d-1', { dueCardsCount: 8 }), deckRow('d-0', { dueCardsCount: 0, card_count: 0 })],
          calendarEvents: [
            calendarEventRow('ev-1', { start_date: '2026-07-10T09:00:00Z' }),
            calendarEventRow('ev-2', { is_all_day: 1 }),
          ],
        }),
      );

      // 2 clases + 5 exam + 5 deadline + 1 deck + 2 timed = 15 notificaciones.
      expect(core.provider.scheduled).toHaveLength(15);
      expect(core.provider.cancelled).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });

    it('reinicio offline con la matriz completa → el estado reconstruido es idéntico al incremental', async () => {
      const service = new ReminderPreferencesService(new MemoryStore());
      const core = buildCore();
      const snap = () =>
        snapshot([scheduleRow('s-1')], {
          assessments: [assessmentRow('a-exam', { assessment_type: 'exam', starts_at: '2026-07-22T10:00:00Z' })],
          decks: [deckRow('d-1', { dueCardsCount: 8 })],
          calendarEvents: [calendarEventRow('ev-1', { start_date: '2026-07-10T09:00:00Z' })],
        });

      let engine = createEngine(() => service.get(), core).engine;
      await engine.initialize(snap());
      const before = stateOf(core.provider);
      expect(before.ids).toHaveLength(9); // 1 clase + 5 exam + 1 deck + 2 timed

      engine.destroy();
      engine = createEngine(() => service.get(), core).engine;
      await engine.initialize(snap());

      expect(stateOf(core.provider)).toEqual(before);
      expect(core.provider.cancelled).toHaveLength(0);
      await assertConverged(engine, core.provider);
    });
  });
});
