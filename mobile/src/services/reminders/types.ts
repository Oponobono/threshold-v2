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

export interface Reminder {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
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

export interface EntitySnapshot {
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
