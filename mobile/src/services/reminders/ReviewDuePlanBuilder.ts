// ── ReviewDuePlanBuilder (S2 — FSRS agregado diario) ─────────────────────
//
// Contrato v1.1 (Ago 2026):
//   - Un mazo con tarjetas pendientes (dueCardsCount/card_count > 0) genera
//     EXACTAMENTE 1 recordatorio diario por día, con identidad estable:
//         flashcard_deck::<deckId>::daily
//   - checkTime = prefs.categories.flashcard_deck.checkTime ?? CHECK_TIME_DEFAULT
//     ('19:00'). 19:00 es SOLO un default configurable; nunca un valor impuesto.
//   - El engine NO guarda estado mutable de dueCardsCount: lee el snapshot en
//     cada build (initialize / evento / resync). dueCardsCount === 0 → la
//     secuencia no nace (shouldCancel del policy).
//   - Quiet hours → OMIT, no defer: el scheduledAt (checkTime de hoy o mañana)
//     se verifica contra la ventana; si cae dentro, la secuencia no nace.
//   - notificationsEnabled = false → 0 secuencias (master switch; el engine
//     además vacía el plan completo). Categoría 'flashcard_deck' disabled →
//     0 secuencias.
//   - Se programa la PRÓXIMA ocurrencia: hoy a checkTime si aún no pasó; si no,
//     mañana a checkTime. Cada run del engine avanza a la siguiente ocurrencia.
//   - expiresAt = null (recordatorio recurrente diario; se cancela con
//     `action_completed` o cuando dueCardsCount llega a 0).
//
//   Puro: no hace IO, no importa infraestructura. `log` es un hook opcional
//   de observabilidad que el engine inyecta; en tests se omite.

import { CHECK_TIME_DEFAULT, getCategoryCheckTime, isCategoryEnabled, isInQuietHours } from './ReminderPreferences';
import type { ReminderPreferences } from './ReminderPreferences';
import type { ReminderSequence, ReminderProfile } from './types';
import type { ReminderPolicy } from './policies/ReminderPolicy';
import type { SequenceFactory } from './SequenceFactory';

const REVIEW_CATEGORY = 'flashcard_deck' as const;
const DAILY_SUFFIX = 'daily';

export interface ReviewDuePlanBuilderDeps {
  readonly policy: ReminderPolicy;
  readonly factory: SequenceFactory;
  readonly now: Date;
}

export type ReviewBuildOutcome = 'active' | 'cancelled' | 'expired' | 'omitted' | 'skipped';

export interface ReviewBuildOptions {
  readonly log?: (
    deck: any,
    outcome: ReviewBuildOutcome,
    scheduledAt?: Date | null,
    checkTime?: string,
  ) => void;
}

function parseHHMM(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { hours: h, minutes: m };
}

/** Próxima ocurrencia diaria a checkTime: hoy si aún no pasó; si no, mañana. */
export function nextCheckTimeOccurrence(now: Date, checkTime: string): Date {
  const { hours, minutes } = parseHHMM(checkTime);
  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function cardsDue(entity: any): number | null {
  const v = entity?.dueCardsCount ?? entity?.card_count;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function buildReviewDueSequences(
  decks: readonly any[],
  prefs: ReminderPreferences,
  deps: ReviewDuePlanBuilderDeps,
  options?: ReviewBuildOptions,
): ReminderSequence[] {
  if (!prefs.notificationsEnabled || !isCategoryEnabled(prefs, REVIEW_CATEGORY)) {
    return [];
  }

  const sequences: ReminderSequence[] = [];
  for (const deck of decks) {
    const seq = buildReviewDueSequence(deck, prefs, deps, options);
    if (seq) sequences.push(seq);
  }
  return sequences;
}

export function buildReviewDueSequence(
  deck: any,
  prefs: ReminderPreferences,
  deps: ReviewDuePlanBuilderDeps,
  options?: ReviewBuildOptions,
): ReminderSequence | null {
  const { policy, factory, now } = deps;

  if (!prefs.notificationsEnabled || !isCategoryEnabled(prefs, REVIEW_CATEGORY)) {
    options?.log?.(deck, 'skipped');
    return null;
  }

  const due = cardsDue(deck);
  if (due == null || due <= 0) {
    options?.log?.(deck, 'cancelled');
    return null;
  }

  const checkTime = getCategoryCheckTime(prefs);
  const scheduledAt = nextCheckTimeOccurrence(now, checkTime);

  if (isInQuietHours(prefs, { hours: scheduledAt.getHours(), minutes: scheduledAt.getMinutes() })) {
    options?.log?.(deck, 'omitted', scheduledAt, checkTime);
    return null;
  }

  const deckId = String(deck?.id ?? '');
  const pseudoRow = {
    ...deck,
    id: deckId,
    dueCardsCount: due,
    card_count: due,
    status: 'active',
  };

  const profile: ReminderProfile = { name: 'custom', defaultOffsets: [0] };
  const built = factory.buildSequence(pseudoRow, 'flashcard_deck', [0], profile, null, scheduledAt);

  if (policy.shouldCancel(built, pseudoRow)) {
    options?.log?.(deck, 'cancelled', scheduledAt, checkTime);
    return null;
  }

  // Identidad diaria estable: flashcard_deck::<deckId>::daily
  const dailyId = `${built.entityType}::${deckId}::${DAILY_SUFFIX}`;
  const reminders = built.reminders.map((r, i) => ({
    ...r,
    id: `${dailyId}::${i}`,
    sequenceId: dailyId,
  }));

  const seq: ReminderSequence = Object.freeze({
    ...built,
    id: dailyId,
    reminders: Object.freeze(reminders),
  });

  options?.log?.(deck, 'active', scheduledAt, checkTime);
  return seq;
}
