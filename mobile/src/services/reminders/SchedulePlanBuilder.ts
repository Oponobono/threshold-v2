// ── SchedulePlanBuilder (WIRING — Fase 4) ───────────────────────────────
//
// Frontera físico→lógico → configuración → materialización:
//   SQLite schedules → SessionMerger → LogicalSession
//   LogicalSession + ReminderPreferences → single reminder intent
//   → Desired plan → NotificationReconciler → OS
//
// Contrato (Ago 2026):
//   - Una sesión lógica → máximo UN reminder.
//   - Uno o más offsets: getCategoryOffsets(prefs, 'schedule') = category.offsets ?? [defaultOffset].
//   - Categoría 'schedule' disabled → 0 intents.
//   - notificationsEnabled = false → 0 intents (master switch; el engine además
//     vacía el plan completo).
//   - Quiet hours → OMIT, no defer: el instante scheduledAt = eventTime − offset
//     se verifica contra la ventana; si cae dentro, la secuencia no nace.
//   - Sesión no clasificable (sin day_of_week o sin start_time) → sin ancla
//     temporal → sin secuencia (Fase 3).
//   - Sesión cancelada = TODAS sus filas físicas con status 'cancelled' → omitida.
//     Con al menos una fila activa, la sesión es activa (las filas absorbidas
//     no multiplican).
//   - El pseudo-row (id = id de sesión lógica) es la entidad que atraviesa
//     SequenceFactory → NotificationReconciler. La identidad de secuencia es
//     schedule::<logicalId>: N filas duplicadas de la misma clase → 1 secuencia
//     → 1 notificación.
//   - NotificationReconciler y SequenceFactory NO se tocan: esta capa les
//     entrega exactamente 1 reminder por intent lógico.
//
//   Puro: no hace IO, no importa infraestructura. `log` es un hook opcional
//   de observabilidad que el engine inyecta; en tests se omite.

import { mergeScheduleRows } from './SessionMerger';
import type { LogicalSession } from './SessionMerger';
import { getCategoryOffsets, isCategoryEnabled, isInQuietHours } from './ReminderPreferences';
import type { ReminderPreferences } from './ReminderPreferences';
import type { ReminderSequence, ReminderProfile } from './types';
import type { ReminderPolicy } from './policies/ReminderPolicy';
import type { SequenceFactory } from './SequenceFactory';

const SCHEDULE_CATEGORY = 'schedule' as const;

export interface SchedulePlanBuilderDeps {
  readonly policy: ReminderPolicy;
  readonly factory: SequenceFactory;
  readonly now: Date;
}

export type ScheduleBuildOutcome = 'active' | 'cancelled' | 'expired' | 'omitted' | 'skipped';

export interface ScheduleBuildOptions {
  readonly excludeSessionIds?: ReadonlySet<string>;
  readonly log?: (
    session: LogicalSession,
    outcome: ScheduleBuildOutcome,
    eventTime?: Date | null,
    scheduledAt?: Date | null,
    offset?: number,
  ) => void;
}

function toTimeOfDay(date: Date): { hours: number; minutes: number } {
  return { hours: date.getHours(), minutes: date.getMinutes() };
}

export function buildScheduleSequences(
  rows: readonly any[],
  prefs: ReminderPreferences,
  deps: SchedulePlanBuilderDeps,
  options?: ScheduleBuildOptions,
): ReminderSequence[] {
  if (!prefs.notificationsEnabled || !isCategoryEnabled(prefs, SCHEDULE_CATEGORY)) {
    return [];
  }

  const sessions = mergeScheduleRows(rows as any);
  const rowsById = new Map<string, any>();
  for (const row of rows) {
    rowsById.set(String(row?.id), row);
  }

  const sequences: ReminderSequence[] = [];

  for (const session of sessions) {
    if (options?.excludeSessionIds?.has(session.id)) {
      options.log?.(session, 'skipped');
      continue;
    }
    const seq = buildSessionSequence(session, rowsById, prefs, deps, options?.log);
    if (seq) sequences.push(seq);
  }

  return sequences;
}

export function buildSessionSequence(
  session: LogicalSession,
  rowsById: Map<string, any>,
  prefs: ReminderPreferences,
  deps: SchedulePlanBuilderDeps,
  log?: ScheduleBuildOptions['log'],
): ReminderSequence | null {
  const { policy, factory, now } = deps;

  if (!session.classifiable) {
    log?.(session, 'skipped');
    return null;
  }

  if (!prefs.notificationsEnabled || !isCategoryEnabled(prefs, SCHEDULE_CATEGORY)) {
    log?.(session, 'skipped');
    return null;
  }

  const sourceRows = session.sourceScheduleIds
    .map((id) => rowsById.get(id))
    .filter((r): r is any => r != null);

  const allCancelled = sourceRows.length > 0 && sourceRows.every((r) => r.status === 'cancelled');
  if (allCancelled) {
    log?.(session, 'cancelled');
    return null;
  }

  const first = sourceRows[0] ?? {};
  const pseudoRow = {
    id: session.id,
    subject_id: session.subjectId,
    subject_name: first.subject_name ?? '',
    day_of_week: session.dayOfWeek,
    start_time: session.startTime,
    end_time: session.endTime,
    name: session.name,
    status: 'active',
  };

  const eventTime = policy.getEventTime?.(pseudoRow, now) ?? null;
  if (!eventTime) {
    log?.(session, 'skipped');
    return null;
  }

  const offsets = getCategoryOffsets(prefs, SCHEDULE_CATEGORY);
  const validOffsets: number[] = [];

  for (const offset of offsets) {
    const scheduledAt = new Date(eventTime.getTime() - offset * 60000);
    if (isInQuietHours(prefs, toTimeOfDay(scheduledAt))) {
      log?.(session, 'omitted', eventTime, scheduledAt, offset);
    } else {
      validOffsets.push(offset);
    }
  }

  if (validOffsets.length === 0) {
    return null;
  }

  const schedulingOffsets = validOffsets.map(o => -o);
  const profile: ReminderProfile = { name: 'custom', defaultOffsets: schedulingOffsets };
  const expiresAt = policy.getExpiration(pseudoRow, now);
  const seq = factory.buildSequence(pseudoRow, 'schedule', schedulingOffsets, profile, expiresAt, eventTime);

  if (policy.shouldCancel(seq, pseudoRow)) {
    log?.(session, 'cancelled');
    return null;
  }

  for (const offset of validOffsets) {
    const scheduledAt = new Date(eventTime.getTime() - offset * 60000);
    log?.(session, 'active', eventTime, scheduledAt, offset);
  }
  
  return seq;
}
