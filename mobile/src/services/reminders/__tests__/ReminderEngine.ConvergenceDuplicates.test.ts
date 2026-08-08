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
import { auditSchedules } from '../ReminderDiagnosticsCore';
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
      'entity.flashcard_deck': 'Mazo',
      'entity.calendar_event': 'Evento',
      'intentTitle.attend_class': 'Asistir a {entity}',
      'intentBody.attend_class': 'Tu {entity} comienza.',
      'intentTitle.prepare_exam': 'Preparar {entity}',
      'intentBody.prepare_exam': 'Tu {entity} se acerca.',
      'intentTitle.review_cards': 'Repasar {entity}',
      'intentBody.review_cards': 'Tienes tarjetas pendientes.',
      'intentTitle.follow_up': 'Seguimiento',
      'intentBody.follow_up': 'Tienes seguimiento pendiente.',
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

// Miércoles 8 Jul 2026 10:00 *local* → getDay()=3 en cualquier zona horaria.
// Clase lunes (dow=1) 08:00 → próxima ocurrencia: lunes 13 Jul 08:00 (futuro).
const ANCHOR = new Date(2026, 6, 8, 10, 0, 0, 0);

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

const CLASS = {
  subject_id: 'subj-1',
  day_of_week: 1,
  start_time: '08:00',
  end_time: '09:00',
  status: 'active',
};

function scheduleRow(id: string) {
  return { id, ...CLASS };
}

function snapshot(rows: readonly any[]): ReminderSourceSnapshot {
  return {
    schedules: rows,
    assessments: [],
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

function toRawSchedule(row: any) {
  return {
    id: row.id,
    day_of_week: row.day_of_week ?? null,
    start_time: row.start_time ?? null,
    end_time: row.end_time ?? null,
    subject_id: row.subject_id,
  };
}

describe('Convergencia determinística del reconciler (Fase 0)', () => {
  it('initialize+reconcile x3 con filas duplicadas: no acumula ni deriva', async () => {
    const rows = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];
    // Misma clase lógica (subject subj-1, lunes 08:00) con 3 filas físicas.
    const audit = auditSchedules(rows.map(toRawSchedule));
    expect(audit.physicalRows).toBe(3);
    expect(audit.logicalSchedules).toBe(1);
    expect(audit.duplicateRows).toBe(2);

    const { engine, provider } = createEngine();
    await engine.initialize(snapshot(rows));
    const after1 = stateOf(provider);

    await engine.initialize(snapshot(rows));
    const after2 = stateOf(provider);

    await engine.initialize(snapshot(rows));
    const after3 = stateOf(provider);

    expect(after2).toEqual(after1);
    expect(after3).toEqual(after1);
    // Sin churn: el plan deseado no cambia entre ejecuciones → el reconciler
    // no cancela ni re-agenda nada (MISS/ORPHAN en el diagnóstico real).
    expect(provider.cancelled.length).toBe(0);
    // La multiplicidad llega al OS: 3 filas x 3 offsets (perfil standard [-30,-5,0]).
    expect(provider.scheduled.length).toBe(9);
  });

  it('independencia del orden: clases distintas en orden A vs mezclado → estado idéntico', async () => {
    const a = [
      { id: 's-1', subject_id: 'a', day_of_week: 1, start_time: '08:00', end_time: '09:00', status: 'active' },
      { id: 's-2', subject_id: 'b', day_of_week: 2, start_time: '09:00', end_time: '10:00', status: 'active' },
      { id: 's-3', subject_id: 'c', day_of_week: 3, start_time: '10:00', end_time: '11:00', status: 'active' },
    ];
    const b = [a[2], a[0], a[1]];

    const engineOrderA = createEngine();
    await engineOrderA.engine.initialize(snapshot(a));
    const stateA = stateOf(engineOrderA.provider);

    const engineOrderB = createEngine();
    await engineOrderB.engine.initialize(snapshot(b));
    const stateB = stateOf(engineOrderB.provider);

    expect(stateB).toEqual(stateA);
    expect(stateA.ids).toHaveLength(9); // 3 clases x 3 offsets, sin colisiones
  });

  it('duplicados con orden mezclado: mismo conjunto de intents (ids) y sin acumulación', async () => {
    const rowsA = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];
    const rowsB = [rowsA[2], rowsA[0], rowsA[1]];

    const tryA = createEngine();
    await tryA.engine.initialize(snapshot(rowsA));
    const stateA = stateOf(tryA.provider);

    const tryB = createEngine();
    await tryB.engine.initialize(snapshot(rowsB));
    const stateB = stateOf(tryB.provider);

    // El conjunto de identificadores de intents es idéntico.
    expect(stateB.ids).toEqual(stateA.ids);
    expect(stateA.ids).toHaveLength(9);
    // La asignación de tiempos de colisión (mismo minuto) puede rotar entre ids
    // idénticos, pero el multiset de tiempos es el mismo.
    expect(stateB.times).toEqual(stateA.times);
  });
});

describe('Integridad de intents lógicos (Fase 0 — evidencia del multiplicador)', () => {
  it('mide la brecha actual: cada fila duplicada genera una secuencia propia en el plan deseado', async () => {
    const rows = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];
    const { engine, provider } = createEngine();
    await engine.initialize(snapshot(rows));

    const logicalSchedules = 1;          // 1 clase lógica: subj-1, lunes 08:00
    const offsetsPerSequence = 3;        // perfil standard [-30,-5,0]
    const expectedIntents = logicalSchedules * offsetsPerSequence; // 3

    // Evidencia: el engine multiplica por filas físicas en la frontera de identidad
    // (seq.id es por fila física: schedule::<id>), no por intent lógico.
    expect(provider.scheduled.length).toBe(expectedIntents * rows.length);

    // Baseline semántico exigido por la Fase 0: 1 intent lógico → 1 recordatorio por offset.
    const byOrdinal = new Map<number, number>();
    for (const r of provider.scheduled) {
      const m = r.id.match(/::(\d+)$/);
      if (m) byOrdinal.set(Number(m[1]), (byOrdinal.get(Number(m[1])) ?? 0) + 1);
    }
    expect(byOrdinal.size).toBe(3);
    // 1 fila debería aportar 1 reminder por offset; con 3 filas duplicadas hay 3 por offset.
    for (const count of byOrdinal.values()) {
      expect(count).toBe(3);
    }
  });

  it.skip('CONTRATO — cada intent lógico produce exactamente 1 recordatorio por offset (se habilita cuando la identidad del engine sea por intent lógico)', async () => {
    const rows = [scheduleRow('s-1'), scheduleRow('s-2'), scheduleRow('s-3')];
    const { engine, provider } = createEngine();
    await engine.initialize(snapshot(rows));

    // Contrato objetivo (Fase 1/3): con N filas duplicadas de la misma clase lógica,
    // el OS debe tener exactamente 1 reminder por offset, no N.
    const byOrdinal = new Map<number, number>();
    for (const r of provider.scheduled) {
      const m = r.id.match(/::(\d+)$/);
      if (m) byOrdinal.set(Number(m[1]), (byOrdinal.get(Number(m[1])) ?? 0) + 1);
    }
    expect(byOrdinal.size).toBe(3);
    for (const count of byOrdinal.values()) {
      expect(count).toBe(1);
    }
  });
});
