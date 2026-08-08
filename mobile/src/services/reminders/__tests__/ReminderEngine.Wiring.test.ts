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
import { DEFAULT_PREFERENCES, parseReminderPreferences } from '../ReminderPreferences';
import type { ReminderPreferences } from '../ReminderPreferences';
import type {
  NotificationProvider,
  ScheduledNotificationInfo,
} from '../NotificationProvider';
import type { ScheduledReminder, ReminderSourceSnapshot } from '../types';
import type { I18nService } from '../I18nService';

// ── Fakes (mismas convenciones que ReminderEngine.test.ts) ─────────────

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

// Miércoles 8 Jul 2026 10:00 local. Clase lunes (dow=1) 08:00 → lunes 13 Jul.
const ANCHOR = new Date(2026, 6, 8, 10, 0, 0, 0);

function createEngine(prefsGetter?: () => ReminderPreferences): {
  engine: ReminderEngine;
  provider: FakeProvider;
  clock: FakeClock;
} {
  const clock = new FakeClock(ANCHOR);
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());

  const provider = new FakeProvider();
  const engine = new ReminderEngine(
    registry,
    new SequenceFactory(clock, new ReminderSnapshotAssembler()),
    new InterruptionPolicy(clock),
    new TemplateResolver(new FakeI18n()),
    new NotificationReconciler(),
    provider,
    clock,
    prefsGetter,
  );

  return { engine, provider, clock };
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

function snapshot(
  rows: readonly any[],
  extra: { assessments?: readonly any[] } = {},
): ReminderSourceSnapshot {
  return {
    schedules: rows,
    assessments: extra.assessments ?? [],
    flashcard_decks: [],
    calendar_events: [],
  };
}

function stateOf(provider: FakeProvider) {
  return {
    ids: provider.scheduled.map((r) => r.id).sort(),
    times: provider.scheduled.map((r) => r.scheduledAt.getTime()).sort((a, b) => a - b),
  };
}

const DEFAULTS: ReminderPreferences = parseReminderPreferences(DEFAULT_PREFERENCES);

describe('WIRING — ReminderPreferences + SessionMerger en el pipeline (Fase 4)', () => {
  it('sin provider de prefs: legado intacto (3 filas duplicadas → 9 reminders)', async () => {
    const rows = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];
    const { engine, provider } = createEngine();
    await engine.initialize(snapshot(rows));

    expect(provider.scheduled.length).toBe(9);
  });

  it('3 filas duplicadas → 1 sesión lógica → 1 reminder (multiplicador CERRADO)', async () => {
    const rows = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const { engine, provider } = createEngine(() => currentPrefs);
    await engine.initialize(snapshot(rows));

    // 1 clase lógica (subj-1, lunes 08:00) → 1 secuencia → 1 notificación.
    expect(provider.scheduled.length).toBe(1);

    const reminder = provider.scheduled[0];
    expect(reminder.id).toMatch(/^schedule::logical::.*::offset::15$/);
    expect(reminder.scheduledAt).toEqual(new Date(2026, 6, 13, 7, 45, 0, 0));
    expect(provider.cancelled.length).toBe(0);
  });

  it('offset por categoría respetado (offsets=[30] → 30 min antes)', async () => {
    const rows = [scheduleRow('s-1')];
    const prefs = parseReminderPreferences({
      ...DEFAULT_PREFERENCES,
      categories: { ...DEFAULT_PREFERENCES.categories, schedule: { enabled: true, offsets: [30] } },
    });
    const { engine, provider } = createEngine(() => prefs);
    await engine.initialize(snapshot(rows));

    expect(provider.scheduled).toHaveLength(1);
    expect(provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 13, 7, 30, 0, 0));
  });

  it('categoría schedule disabled → 0 reminders de clase; otras entidades intactas', async () => {
    const prefs = parseReminderPreferences({
      ...DEFAULT_PREFERENCES,
      categories: { ...DEFAULT_PREFERENCES.categories, schedule: { enabled: false } },
    });
    const { engine, provider } = createEngine(() => prefs);
    await engine.initialize(
      snapshot([scheduleRow('s-1')], {
        assessments: [
          { id: 'a-1', subject_id: 'subj-1', assessment_type: 'exam', starts_at: '2026-07-22T10:00:00Z', status: 'active' },
        ],
      }),
    );

    expect(provider.scheduled.some((r) => r.id.startsWith('schedule::'))).toBe(false);
    // Assessment standard [-10080,-4320,-1440,-60,0] → 5 reminders en el futuro.
    expect(provider.scheduled).toHaveLength(5);
  });

  it('master switch notificationsEnabled=false → plan vacío (incluye assessment)', async () => {
    const prefs = parseReminderPreferences({
      ...DEFAULT_PREFERENCES,
      notificationsEnabled: false,
    });
    const { engine, provider } = createEngine(() => prefs);
    await engine.initialize(
      snapshot([scheduleRow('s-1')], {
        assessments: [{ id: 'a-1', subject_id: 'subj-1', assessment_type: 'exam', starts_at: '2026-07-22T10:00:00Z', status: 'active' }],
      }),
    );

    expect(provider.scheduled).toHaveLength(0);
    const plan = await engine.computeCurrentPlan(snapshot([scheduleRow('s-1')]));
    expect(plan.deliverables).toHaveLength(0);
  });

  it('quiet hours → OMIT, no defer (clase 07:00 con offset 15 → 06:45 dentro de la ventana)', async () => {
    const prefs = parseReminderPreferences({
      ...DEFAULT_PREFERENCES,
      quietHours: { enabled: true, start: '22:30', end: '07:00' },
    });
    const rows = [
      scheduleRow('s-early', { day_of_week: 3, start_time: '07:00', end_time: '08:00' }),
      scheduleRow('s-ok', { day_of_week: 3, start_time: '09:00', end_time: '10:00' }),
    ];
    const { engine, provider } = createEngine(() => prefs);
    await engine.initialize(snapshot(rows));

    // Solo la clase 09:00 sobrevive (08:45 fuera de quiet hours); 06:45 se omite.
    expect(provider.scheduled).toHaveLength(1);
    expect(provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 15, 8, 45, 0, 0));
  });

  it('action_completed excluye la sesión del plan deseado (otra sesión intacta)', async () => {
    const rows = [
      scheduleRow('s-1', { subject_id: 'subj-a' }),
      scheduleRow('s-2', { subject_id: 'subj-b', day_of_week: 2, start_time: '09:00', end_time: '10:00' }),
    ];
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const { engine, provider } = createEngine(() => currentPrefs);
    await engine.initialize(snapshot(rows));
    expect(provider.scheduled).toHaveLength(2);

    await engine.onActionCompleted('schedule', 's-1');

    const plan = await engine.computeCurrentPlan();
    expect(plan.deliverables).toHaveLength(1);
    expect(plan.deliverables[0].id).toMatch(/^schedule::logical::/);

    // Re-initialize con el mismo snapshot: la sesión completada vuelve (fresh).
    await engine.initialize(snapshot(rows));
    expect(provider.scheduled).toHaveLength(2);
  });

  it('entity_deleted reconstruye el grupo (eliminar 1 fila duplicada conserva la sesión)', async () => {
    const rows = [scheduleRow('s-1'), scheduleRow('s-2')];
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const { engine, provider } = createEngine(() => currentPrefs);
    await engine.initialize(snapshot(rows));
    expect(provider.scheduled).toHaveLength(1);

    await engine.onEntityDeleted('schedule', 's-1');
    let plan = await engine.computeCurrentPlan();
    // La sesión lógica sobrevive mientras quede al menos una fila física.
    expect(plan.deliverables).toHaveLength(1);

    await engine.onEntityDeleted('schedule', 's-2');
    plan = await engine.computeCurrentPlan();
    expect(plan.deliverables).toHaveLength(0);
  });

  it('entity_changed upserta la fila y reconstruye el grupo', async () => {
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const { engine, provider } = createEngine(() => currentPrefs);
    await engine.initialize(snapshot([]));
    expect(provider.scheduled).toHaveLength(0);

    await engine.onEntityChanged('schedule', 's-1', scheduleRow('s-1'));
    expect(provider.scheduled).toHaveLength(1);
    expect(provider.scheduled[0].scheduledAt).toEqual(new Date(2026, 6, 13, 7, 45, 0, 0));
  });

  it('sesión no clasificable (sin day_of_week) → sin secuencia', async () => {
    const rows = [scheduleRow('s-1', { day_of_week: null })];
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const { engine, provider } = createEngine(() => currentPrefs);
    await engine.initialize(snapshot(rows));
    expect(provider.scheduled).toHaveLength(0);
  });

  it('todas las filas canceladas → omitida; con una activa → activa', async () => {
    const allCancelled = [scheduleRow('s-1', { status: 'cancelled' }), scheduleRow('s-2', { status: 'cancelled' })];
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const cancelledEngine = createEngine(() => currentPrefs);
    await cancelledEngine.engine.initialize(snapshot(allCancelled));
    expect(cancelledEngine.provider.scheduled).toHaveLength(0);

    const mixed = [scheduleRow('s-1', { status: 'cancelled' }), scheduleRow('s-2', { status: 'active' })];
    const activeEngine = createEngine(() => currentPrefs);
    await activeEngine.engine.initialize(snapshot(mixed));
    expect(activeEngine.provider.scheduled).toHaveLength(1);
  });

  it('clases distintas → 1 reminder cada una', async () => {
    const rows = [
      scheduleRow('s-1', { subject_id: 'subj-a' }),
      scheduleRow('s-2', { subject_id: 'subj-b', day_of_week: 2, start_time: '09:00', end_time: '10:00' }),
      scheduleRow('s-3', { subject_id: 'subj-c', day_of_week: 3, start_time: '10:00', end_time: '11:00' }),
    ];
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const { engine, provider } = createEngine(() => currentPrefs);
    await engine.initialize(snapshot(rows));

    expect(provider.scheduled).toHaveLength(3);
  });

  it('determinismo: initialize x2 → estado idéntico y sin churn', async () => {
    const rows = [scheduleRow('s-1'), scheduleRow('s-2')];
    let currentPrefs: ReminderPreferences = DEFAULTS;
    const { engine, provider } = createEngine(() => currentPrefs);
    await engine.initialize(snapshot(rows));
    const after1 = stateOf(provider);

    await engine.initialize(snapshot(rows));
    const after2 = stateOf(provider);

    expect(after2).toEqual(after1);
    expect(provider.cancelled.length).toBe(0);
    expect(provider.scheduled).toHaveLength(1);
  });


  it('churn de reconciliación: transiciones de offsets garantizan estabilidad (Multi-Offset)', async () => {
    const rows = [scheduleRow('s-1')];
    let prefs = parseReminderPreferences({
      categories: { schedule: { enabled: true, offsets: [15, 30] } },
    });
    const { engine, provider } = createEngine(() => prefs);

    // 1. [15, 30] inicial → 2 programados, 0 cancelados
    await engine.initialize(snapshot(rows));
    expect(provider.scheduled).toHaveLength(2);
    expect(provider.cancelled).toHaveLength(0);
    const id15 = provider.scheduled.find((r) => r.id.endsWith('offset::15'))!.id;
    const id30 = provider.scheduled.find((r) => r.id.endsWith('offset::30'))!.id;
    expect(id15).toBeDefined();
    expect(id30).toBeDefined();
    provider.cancelled.length = 0; // limpiar sólo el log de cancelaciones

    // 2. [15, 30] → [30, 15] (mismo conjunto, distinto orden; parse normaliza → idéntico)
    prefs = parseReminderPreferences({
      categories: { schedule: { enabled: true, offsets: [30, 15] } },
    });
    await engine.initialize(snapshot(rows));
    // OS estable: el reconciler ve 2 en el OS = 2 en el plan → 0 cambios
    expect(provider.scheduled).toHaveLength(2);
    expect(provider.cancelled).toHaveLength(0);
    provider.cancelled.length = 0;

    // 3. [15, 30] → [15] → debe cancelar el de 30, OS queda con 1
    prefs = parseReminderPreferences({
      categories: { schedule: { enabled: true, offsets: [15] } },
    });
    await engine.initialize(snapshot(rows));
    expect(provider.scheduled).toHaveLength(1);  // sólo el de 15 en el OS
    expect(provider.cancelled).toHaveLength(1);
    expect(provider.cancelled[0]).toBe(id30);
    provider.cancelled.length = 0;

    // 4. [15] → [15, 60] → debe añadir el de 60, OS queda con 2
    prefs = parseReminderPreferences({
      categories: { schedule: { enabled: true, offsets: [15, 60] } },
    });
    await engine.initialize(snapshot(rows));
    expect(provider.scheduled).toHaveLength(2);
    expect(provider.scheduled.map((r) => r.id)).toContain(id15);     // 15 intacto
    expect(provider.scheduled.find((r) => r.id.endsWith('offset::60'))).toBeDefined();
    expect(provider.cancelled).toHaveLength(0);
  });
});
