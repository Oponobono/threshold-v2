export type ReminderIntent =
  | 'prepare_exam'
  | 'attend_class'
  | 'review_cards'
  | 'submit_work'
  | 'digest'
  | 'follow_up';

export type InterruptionPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ReminderProfile {
  readonly name: 'minimal' | 'standard' | 'persistent' | 'custom';
  readonly defaultOffsets: readonly number[];
  readonly customOffsets?: readonly number[];
}

export type ReminderStatus =
  | 'pending'
  | 'scheduled'
  | 'delivered'
  | 'tapped'
  | 'dismissed'
  | 'ignored'
  | 'superseded';

export type SequenceStatus =
  | 'active'
  | 'waiting_feedback'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type ReminderOutcome =
  | 'tapped'
  | 'dismissed'
  | 'ignored'
  | 'completed'
  | 'expired'
  | 'superseded';

// ── Reminder sub-snapshots (Value Objects inmutables) ─────────────────

/**
 * Frozen snapshot of the entity identity at reminder creation time.
 * Intentionally duplicates Reminder.entityId / .entityType so the snapshot
 * is self-contained for presentation, debugging and serialization.
 */
export interface ReminderEntitySnapshot {
  readonly id: string;
  readonly type: string;
  readonly name: string;
}

export interface ReminderSubjectSnapshot {
  readonly id: string;
  readonly name: string;
}

export interface ReminderCourseSnapshot {
  readonly id: string;
  readonly name: string;
}

export interface ReminderStatisticsSnapshot {
  readonly dueCount?: number;
  readonly totalCards?: number;
  readonly overdueDays?: number;
}

/**
 * Value Object inmutable — snapshot de la entidad al momento de generar el reminder.
 * Evita consultas a repositorios durante la entrega.
 * Si la entidad cambia después, el snapshot preserva los valores originales intencionalmente.
 *
 * Entity identity (id, type) is intentionally duplicated from Reminder.entityId / .entityType.
 * This snapshot is a frozen presentation state that must remain self-contained
 * for serialization, debugging and analytics — even when detached from the aggregate.
 */
export class ReminderSnapshot {
  public readonly entity: ReminderEntitySnapshot;
  public readonly subject?: ReminderSubjectSnapshot;
  public readonly course?: ReminderCourseSnapshot;
  public readonly statistics?: ReminderStatisticsSnapshot;

  constructor(params: {
    entity: ReminderEntitySnapshot;
    subject?: ReminderSubjectSnapshot;
    course?: ReminderCourseSnapshot;
    statistics?: ReminderStatisticsSnapshot;
  }) {
    this.entity = Object.freeze({ ...params.entity });
    this.subject = params.subject ? Object.freeze({ ...params.subject }) : undefined;
    this.course = params.course ? Object.freeze({ ...params.course }) : undefined;
    this.statistics = params.statistics ? Object.freeze({ ...params.statistics }) : undefined;
    Object.freeze(this);
  }
}

export interface Reminder {
  readonly id: string;
  /** Entity identity used by the scheduling engine for reconciliation, idempotency and cancellation.
   *  Intentionally duplicated inside ReminderSnapshot — the snapshot is a frozen presentation state
   *  that must remain self-contained even when detached from the aggregate. */
  readonly entityType: string;
  /** Entity identity used by the scheduling engine for reconciliation, idempotency and cancellation.
   *  Intentionally duplicated inside ReminderSnapshot — the snapshot is a frozen presentation state
   *  that must remain self-contained even when detached from the aggregate. */
  readonly entityId: string;
  readonly snapshot: ReminderSnapshot;
  readonly subjectId?: string;
  readonly scheduledAt: Date;
  readonly intent: ReminderIntent;
  readonly profile: ReminderProfile;
  readonly priority: InterruptionPriority;
  readonly sequenceId: string;
  readonly ordinal: number;
  readonly status: ReminderStatus;
}

export interface ReminderSequence {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly reminders: readonly Reminder[];
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly status: SequenceStatus;
}

export interface DeliveryPlan {
  readonly planId: string;
  readonly version: number;
  readonly generatedAt: Date;
  readonly deliverables: readonly DeliveryReminderDomain[];
}

export type DeliveryPlanResolved =
  Omit<DeliveryPlan, 'deliverables'> & {
    readonly deliverables: readonly DeliveryReminder[];
  };

export interface DeliveryReminderDomain {
  readonly id: string;
  readonly scheduledAt: Date;
  readonly entityType: string;
  readonly entityId: string;
  readonly snapshot: ReminderSnapshot;
  readonly subjectId?: string;
  readonly intent: ReminderIntent;
  readonly priority: InterruptionPriority;
}

export interface DeliveryReminder extends DeliveryReminderDomain {
  readonly title: string;
  readonly body: string;
  readonly deeplink?: string;
  readonly badge?: number;
}

export interface ReminderWindow {
  readonly offsetMinutes: number;
  readonly reference: 'event_start' | 'event_end' | 'now';
}

export interface EnvironmentContext {
  readonly timezone?: string;
  readonly locale?: string;
  readonly permissions?: PermissionState;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/**
 * Snapshot global que consume el ReminderEngine para generar secuencias.
 * Es la entrada del motor: datos planos desde SQLite sin procesar.
 * No confundir con ReminderSnapshot (snapshot individual por reminder).
 */
export interface ReminderSourceSnapshot {
  readonly assessments?: readonly any[];
  readonly schedules?: readonly any[];
  readonly flashcard_decks?: readonly any[];
  readonly calendar_events?: readonly any[];
  readonly grading_periods?: readonly any[];
}

export interface StageTiming {
  readonly name: string;
  readonly durationMs: number;
  readonly entityCount?: number;
  readonly sequenceCount?: number;
  readonly scheduledCount?: number;
  readonly cancelledCount?: number;
}

export interface EngineTraceEntry {
  readonly timestamp: Date;
  readonly eventType: string;
  readonly durationMs: number;
  readonly sequences: number;
  readonly scheduled: number;
  readonly cancelled: number;
  readonly stages?: readonly StageTiming[];
}

export interface ScheduledReminder {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly scheduledAt: Date;
  readonly priority: InterruptionPriority;
  readonly badge?: number;
  readonly deeplink?: string;
}
