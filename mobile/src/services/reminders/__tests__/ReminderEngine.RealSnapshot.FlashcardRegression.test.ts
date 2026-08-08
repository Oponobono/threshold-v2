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
import { DEFAULT_PREFERENCES, getCategoryCheckTime } from '../ReminderPreferences';
import { buildReviewDueSequence } from '../ReviewDuePlanBuilder';
import type { ReviewDuePlanBuilderDeps } from '../ReviewDuePlanBuilder';
import type { ReminderPolicy } from '../policies/ReminderPolicy';
import type { NotificationProvider, ScheduledNotificationInfo } from '../NotificationProvider';
import type { I18nService } from '../I18nService';
import type { ScheduledReminder, ReminderSourceSnapshot, DeliveryPlanResolved } from '../types';

// ── Snapshot real del dispositivo (diagnóstico 2026-08-07, tz=America/Bogota) ─────
// El bug original: los 3 mazos se anclaban a `now` (esperado=10:03/10:08/10:13) → MISS en el OS.
// Contrato v1.1: un mazo con cards>0 genera EXACTAMENTE 1 recordatorio DIARIO a checkTime
// (default 19:00). Los dos mazos con card_count=0 dejan de generar recordatorios.

const REAL_NOW = new Date(2026, 7, 7, 10, 3, 22, 0); // 2026-08-07 10:03:22 local
const REAL_CHECK_TIME = new Date(2026, 7, 7, 19, 0, 0, 0); // hoy 19:00 local (default checkTime)

const DECK_WITH_CARDS = {
  id: '33f67627-48e7-4f38-af0a-3820408d53bc',
  title: 'Expo',
  card_count: 10,
  status: 'active',
};

const DECK_EMPTY_A = {
  id: 'c7aa6323-94bd-4aac-a30b-5d558a6b409d',
  title: '',
  card_count: 0,
  status: 'active',
};

const DECK_EMPTY_B = {
  id: '817d5cbe-e417-4c41-af2f-83a484130df1',
  title: '',
  card_count: 0,
  status: 'active',
};

const REAL_SNAPSHOT: ReminderSourceSnapshot = {
  assessments: [],
  schedules: [],
  flashcard_decks: [DECK_WITH_CARDS, DECK_EMPTY_A, DECK_EMPTY_B],
  calendar_events: [],
};

// ── Fakes ──────────────────────────────────────────────────────────

class FakeI18n implements I18nService {
  translate(key: string, _params?: any): string {
    const map: Record<string, string> = {
      'entity.flashcard_deck': 'Mazo',
      'intentTitle.review_cards': 'Repasar {entity}',
      'intentBody.review_cards': 'Tienes tarjetas de {entity}.',
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

function createEngine(now: Date): {
  engine: ReminderEngine;
  provider: FakeProvider;
  clock: FakeClock;
} {
  const c = new FakeClock(now);
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

function builderDeps(now: Date): { deps: ReviewDuePlanBuilderDeps; policy: ReminderPolicy } {
  const policy = new ReviewPolicy();
  const clock = new FakeClock(now);
  return {
    deps: {
      policy,
      factory: new SequenceFactory(clock, new ReminderSnapshotAssembler()),
      now: clock.now(),
    },
    policy,
  };
}

// ── Regresión: escenario real del dispositivo ──────────────────────

describe('FlashcardScheduling RealWorld Regression (v1.1 — FSRS diario)', () => {
  it('el mazo con cards=10 sobrevive shouldCancel (cards>0 → false)', () => {
    const { policy } = builderDeps(REAL_NOW);
    const seq = new SequenceFactory(
      new FakeClock(REAL_NOW),
      new ReminderSnapshotAssembler(),
    ).buildSequence(DECK_WITH_CARDS, 'flashcard_deck', [0], { name: 'standard', defaultOffsets: [0] });

    expect(policy.shouldCancel(seq, DECK_WITH_CARDS)).toBe(false);
  });

  it('los mazos con card_count=0 se cancelan via shouldCancel', () => {
    const { policy } = builderDeps(REAL_NOW);
    const factory = new SequenceFactory(new FakeClock(REAL_NOW), new ReminderSnapshotAssembler());
    const seqA = factory.buildSequence(DECK_EMPTY_A, 'flashcard_deck', [0], { name: 'standard', defaultOffsets: [0] });
    const seqB = factory.buildSequence(DECK_EMPTY_B, 'flashcard_deck', [0], { name: 'standard', defaultOffsets: [0] });

    expect(policy.shouldCancel(seqA, DECK_EMPTY_A)).toBe(true);
    expect(policy.shouldCancel(seqB, DECK_EMPTY_B)).toBe(true);
  });

  it('el ancla temporal es checkTime (19:00 default), nunca now (10:03 → hoy 19:00)', () => {
    expect(getCategoryCheckTime(DEFAULT_PREFERENCES)).toBe('19:00');

    const { deps } = builderDeps(REAL_NOW);
    const seq = buildReviewDueSequence(DECK_WITH_CARDS, DEFAULT_PREFERENCES, deps);

    expect(seq).not.toBeNull();
    expect(seq!.reminders[0].scheduledAt.getTime()).toBe(REAL_CHECK_TIME.getTime());
    expect(seq!.reminders[0].scheduledAt.getTime()).not.toBe(REAL_NOW.getTime());
  });

  it('el engine agenda solo el mazo con cards, hoy a las 19:00 (1 recordatorio diario)', async () => {
    const { engine, provider } = createEngine(REAL_NOW);
    await engine.initialize(REAL_SNAPSHOT);

    const seqs = engine.getDesiredSequences();
    expect(seqs).toHaveLength(1);
    expect(seqs[0].entityType).toBe('flashcard_deck');
    expect(seqs[0].id).toBe(`flashcard_deck::${DECK_WITH_CARDS.id}::daily`);
    expect(seqs[0].reminders[0].scheduledAt.getTime()).toBe(REAL_CHECK_TIME.getTime());
    expect(seqs[0].reminders).toHaveLength(1);

    expect(provider.scheduled).toHaveLength(1);
    const reminder = provider.scheduled[0];
    expect(reminder.id).toBe(`flashcard_deck::${DECK_WITH_CARDS.id}::daily::0`);
    expect(reminder.scheduledAt.getTime()).toBe(REAL_CHECK_TIME.getTime());
    expect(reminder.scheduledAt.getTime()).not.toBe(REAL_NOW.getTime());
  });

  it('los mazos vacíos no generan secuencia ni notificación', async () => {
    const { engine, provider } = createEngine(REAL_NOW);
    await engine.initialize(REAL_SNAPSHOT);

    const seqIds = engine.getDesiredSequences().map((s) => s.id);
    expect(seqIds).not.toContain(`flashcard_deck::${DECK_EMPTY_A.id}::daily`);
    expect(seqIds).not.toContain(`flashcard_deck::${DECK_EMPTY_B.id}::daily`);

    const deckReminders = provider.scheduled.filter((r) =>
      r.id.startsWith('flashcard_deck::') && r.id !== `flashcard_deck::${DECK_WITH_CARDS.id}::daily::0`,
    );
    expect(deckReminders).toHaveLength(0);
  });

  it('computeCurrentPlan(snapshot) incluye el mazo con cards en el plan (read-only)', async () => {
    const { engine } = createEngine(REAL_NOW);
    await engine.initialize(REAL_SNAPSHOT);

    const plan: DeliveryPlanResolved = await engine.computeCurrentPlan(REAL_SNAPSHOT);
    const deliverable = plan.deliverables.find((d) =>
      d.id === `flashcard_deck::${DECK_WITH_CARDS.id}::daily::0`,
    );

    expect(deliverable).toBeDefined();
    expect(deliverable!.scheduledAt.getTime()).toBe(REAL_CHECK_TIME.getTime());
    expect(plan.deliverables).toHaveLength(1);
  });

  it('re-initialize produce el mismo scheduledAt (sin churn cancel/recreate)', async () => {
    const { engine, provider } = createEngine(REAL_NOW);

    await engine.initialize(REAL_SNAPSHOT);
    const scheduledAt1 = provider.scheduled.find(
      (r) => r.id === `flashcard_deck::${DECK_WITH_CARDS.id}::daily::0`,
    )!.scheduledAt.getTime();

    await engine.initialize(REAL_SNAPSHOT);
    const scheduledAt2 = provider.scheduled.find(
      (r) => r.id === `flashcard_deck::${DECK_WITH_CARDS.id}::daily::0`,
    )!.scheduledAt.getTime();

    expect(scheduledAt2).toBe(scheduledAt1);
    expect(provider.cancelled).toHaveLength(0);
    expect(provider.scheduled.filter((r) => r.id === `flashcard_deck::${DECK_WITH_CARDS.id}::daily::0`)).toHaveLength(1);
  });
});
