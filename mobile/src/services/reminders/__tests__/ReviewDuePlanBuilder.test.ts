import { PolicyRegistry } from '../policies/PolicyRegistry';
import { ReviewPolicy } from '../policies/ReviewPolicy';
import { SequenceFactory } from '../SequenceFactory';
import { ReminderSnapshotAssembler } from '../ReminderSnapshotAssembler';
import { FakeClock } from '../Clock';
import {
  buildReviewDueSequence,
  buildReviewDueSequences,
  nextCheckTimeOccurrence,
} from '../ReviewDuePlanBuilder';
import type { ReviewDuePlanBuilderDeps } from '../ReviewDuePlanBuilder';
import { DEFAULT_PREFERENCES, parseReminderPreferences } from '../ReminderPreferences';
import type { ReminderPreferences } from '../ReminderPreferences';
import type { ReviewBuildOutcome } from '../ReviewDuePlanBuilder';

// ── Helpers ────────────────────────────────────────────────────────

const ANCHOR = new Date(2026, 6, 8, 10, 0, 0, 0); // Miércoles 8 Jul 2026 10:00 local

function makeDeps(now: Date): ReviewDuePlanBuilderDeps {
  return {
    policy: new ReviewPolicy(),
    factory: new SequenceFactory(new FakeClock(now), new ReminderSnapshotAssembler()),
    now,
  };
}

function prefs(overrides: (p: ReminderPreferences) => ReminderPreferences): ReminderPreferences {
  return overrides(parseReminderPreferences(DEFAULT_PREFERENCES));
}

function deckWith(overrides: Record<string, any> = {}) {
  return { id: 'd1', dueCardsCount: 10, ...overrides };
}

function outcomesOf() {
  const captured: { outcome: ReviewBuildOutcome; scheduledAt?: Date | null; checkTime?: string }[] = [];
  const log = (deck: any, outcome: ReviewBuildOutcome, scheduledAt?: Date | null, checkTime?: string) =>
    captured.push({ outcome, scheduledAt, checkTime });
  return { captured, log };
}

// ── nextCheckTimeOccurrence ────────────────────────────────────────

describe('ReviewDuePlanBuilder — nextCheckTimeOccurrence', () => {
  it('antes de checkTime → hoy a checkTime', () => {
    const now = new Date(2026, 6, 8, 10, 0, 0, 0);
    expect(nextCheckTimeOccurrence(now, '19:00')).toEqual(new Date(2026, 6, 8, 19, 0, 0, 0));
  });

  it('después de checkTime → mañana a checkTime', () => {
    const now = new Date(2026, 6, 8, 20, 30, 0, 0);
    expect(nextCheckTimeOccurrence(now, '19:00')).toEqual(new Date(2026, 6, 9, 19, 0, 0, 0));
  });

  it('exactamente en checkTime → mañana (no programa en el pasado)', () => {
    const now = new Date(2026, 6, 8, 19, 0, 0, 0);
    expect(nextCheckTimeOccurrence(now, '19:00')).toEqual(new Date(2026, 6, 9, 19, 0, 0, 0));
  });

  it('checkTime custom (08:00) antes de la hora actual → hoy 08:00', () => {
    const now = new Date(2026, 6, 8, 6, 0, 0, 0);
    expect(nextCheckTimeOccurrence(now, '08:00')).toEqual(new Date(2026, 6, 8, 8, 0, 0, 0));
  });

  it('checkTime custom (08:00) después de la hora actual → mañana 08:00', () => {
    const now = new Date(2026, 6, 8, 12, 0, 0, 0);
    expect(nextCheckTimeOccurrence(now, '08:00')).toEqual(new Date(2026, 6, 9, 8, 0, 0, 0));
  });
});

// ── buildReviewDueSequence ─────────────────────────────────────────

describe('ReviewDuePlanBuilder — buildReviewDueSequence', () => {
  it('mazo con tarjetas → 1 recordatorio diario a checkTime default (19:00)', () => {
    const seq = buildReviewDueSequence(deckWith(), DEFAULT_PREFERENCES, makeDeps(ANCHOR))!;

    expect(seq).not.toBeNull();
    expect(seq.entityType).toBe('flashcard_deck');
    expect(seq.entityId).toBe('d1');
    expect(seq.id).toBe('flashcard_deck::d1::daily');
    expect(seq.reminders).toHaveLength(1);
    expect(seq.reminders[0].id).toBe('flashcard_deck::d1::daily::0');
    expect(seq.reminders[0].sequenceId).toBe('flashcard_deck::d1::daily');
    expect(seq.reminders[0].ordinal).toBe(0);
    expect(seq.reminders[0].intent).toBe('review_cards');
    expect(seq.reminders[0].scheduledAt).toEqual(new Date(2026, 6, 8, 19, 0, 0, 0));
    expect(seq.expiresAt).toBeNull();
    expect(seq.status).toBe('active');
  });

  it('después de checkTime → mañana a checkTime', () => {
    const now = new Date(2026, 6, 8, 20, 0, 0, 0);
    const seq = buildReviewDueSequence(deckWith(), DEFAULT_PREFERENCES, makeDeps(now))!;
    expect(seq.reminders[0].scheduledAt).toEqual(new Date(2026, 6, 9, 19, 0, 0, 0));
  });

  it('checkTime custom en preferencias → scheduledAt en esa hora', () => {
    const p = prefs((d) => ({
      ...d,
      categories: {
        ...d.categories,
        flashcard_deck: { enabled: true, checkTime: '08:00' },
      },
    }));
    const now = new Date(2026, 6, 8, 6, 0, 0, 0);
    const seq = buildReviewDueSequence(deckWith(), p, makeDeps(now))!;
    expect(seq.reminders[0].scheduledAt).toEqual(new Date(2026, 6, 8, 8, 0, 0, 0));
  });

  it('usa card_count como fallback de dueCardsCount', () => {
    const seq = buildReviewDueSequence({ id: 'd2', card_count: 3 }, DEFAULT_PREFERENCES, makeDeps(ANCHOR))!;
    expect(seq.entityId).toBe('d2');
    expect(seq.reminders).toHaveLength(1);
  });

  it('dueCardsCount === 0 → null (outcome cancelled)', () => {
    const { captured, log } = outcomesOf();
    const result = buildReviewDueSequence(deckWith({ dueCardsCount: 0 }), DEFAULT_PREFERENCES, makeDeps(ANCHOR), {
      log,
    });
    expect(result).toBeNull();
    expect(captured.map((c) => c.outcome)).toEqual(['cancelled']);
  });

  it('sin información de tarjetas → null (outcome cancelled)', () => {
    const { captured, log } = outcomesOf();
    const result = buildReviewDueSequence({ id: 'd1' }, DEFAULT_PREFERENCES, makeDeps(ANCHOR), { log });
    expect(result).toBeNull();
    expect(captured.map((c) => c.outcome)).toEqual(['cancelled']);
  });

  it('quiet hours cubre checkTime → OMIT, no defer', () => {
    const p = prefs((d) => ({
      ...d,
      quietHours: { enabled: true, start: '18:00', end: '21:00' },
    }));
    const { captured, log } = outcomesOf();
    const result = buildReviewDueSequence(deckWith(), p, makeDeps(ANCHOR), { log });
    expect(result).toBeNull();
    expect(captured).toHaveLength(1);
    expect(captured[0].outcome).toBe('omitted');
  });

  it('quiet hours fuera de checkTime → la secuencia nace', () => {
    const p = prefs((d) => ({
      ...d,
      quietHours: { enabled: true, start: '20:00', end: '21:00' },
    }));
    const seq = buildReviewDueSequence(deckWith(), p, makeDeps(ANCHOR))!;
    expect(seq.reminders[0].scheduledAt).toEqual(new Date(2026, 6, 8, 19, 0, 0, 0));
  });

  it('categoría flashcard_deck disabled → null (outcome skipped)', () => {
    const p = prefs((d) => ({
      ...d,
      categories: { ...d.categories, flashcard_deck: { enabled: false, checkTime: null } },
    }));
    const { captured, log } = outcomesOf();
    const result = buildReviewDueSequence(deckWith(), p, makeDeps(ANCHOR), { log });
    expect(result).toBeNull();
    expect(captured.map((c) => c.outcome)).toEqual(['skipped']);
  });

  it('master switch notificationsEnabled=false → null (outcome skipped)', () => {
    const p = prefs((d) => ({ ...d, notificationsEnabled: false }));
    const { captured, log } = outcomesOf();
    const result = buildReviewDueSequence(deckWith(), p, makeDeps(ANCHOR), { log });
    expect(result).toBeNull();
    expect(captured.map((c) => c.outcome)).toEqual(['skipped']);
  });

  it('identidad diaria estable: mismo id en días distintos', () => {
    const seq1 = buildReviewDueSequence(deckWith(), DEFAULT_PREFERENCES, makeDeps(new Date(2026, 6, 8, 10, 0, 0, 0)))!;
    const seq2 = buildReviewDueSequence(deckWith(), DEFAULT_PREFERENCES, makeDeps(new Date(2026, 6, 9, 10, 0, 0, 0)))!;
    expect(seq1.id).toBe(seq2.id);
    expect(seq1.id).toBe('flashcard_deck::d1::daily');
    expect(seq2.reminders[0].scheduledAt).toEqual(new Date(2026, 6, 9, 19, 0, 0, 0));
  });

  it('secuencia y reminders son inmutables (frozen)', () => {
    const seq = buildReviewDueSequence(deckWith(), DEFAULT_PREFERENCES, makeDeps(ANCHOR))!;
    expect(Object.isFrozen(seq)).toBe(true);
    expect(Object.isFrozen(seq.reminders)).toBe(true);
  });
});

// ── buildReviewDueSequences ────────────────────────────────────────

describe('ReviewDuePlanBuilder — buildReviewDueSequences', () => {
  it('entrada vacía → 0 secuencias', () => {
    expect(buildReviewDueSequences([], DEFAULT_PREFERENCES, makeDeps(ANCHOR))).toHaveLength(0);
  });

  it('solo los mazos con tarjetas generan secuencia', () => {
    const decks = [deckWith(), deckWith({ id: 'd2', dueCardsCount: 0 }), deckWith({ id: 'd3', card_count: 5 })];
    const sequences = buildReviewDueSequences(decks, DEFAULT_PREFERENCES, makeDeps(ANCHOR));
    expect(sequences.map((s) => s.entityId)).toEqual(['d1', 'd3']);
  });

  it('gate de categoría disabled aplica a todo el lote', () => {
    const p = prefs((d) => ({
      ...d,
      categories: { ...d.categories, flashcard_deck: { enabled: false, checkTime: null } },
    }));
    expect(buildReviewDueSequences([deckWith()], p, makeDeps(ANCHOR))).toHaveLength(0);
  });

  it('gate de master switch aplica a todo el lote', () => {
    const p = prefs((d) => ({ ...d, notificationsEnabled: false }));
    expect(buildReviewDueSequences([deckWith()], p, makeDeps(ANCHOR))).toHaveLength(0);
  });
});

// ── Integración: registry → builder (vía policy registrada) ────────

describe('ReviewDuePlanBuilder — integración con PolicyRegistry', () => {
  it('construye la secuencia con la policy flashcard_deck registrada', () => {
    const registry = new PolicyRegistry();
    registry.register(new ReviewPolicy());
    const deps: ReviewDuePlanBuilderDeps = {
      policy: registry.get('flashcard_deck'),
      factory: new SequenceFactory(new FakeClock(ANCHOR), new ReminderSnapshotAssembler()),
      now: ANCHOR,
    };
    const seq = buildReviewDueSequence(deckWith(), DEFAULT_PREFERENCES, deps)!;
    expect(seq.id).toBe('flashcard_deck::d1::daily');
    expect(seq.reminders[0].intent).toBe('review_cards');
  });
});

