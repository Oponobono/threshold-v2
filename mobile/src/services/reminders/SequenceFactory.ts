import { Clock } from './Clock';
import { ReminderSnapshotAssembler } from './ReminderSnapshotAssembler';
import type {
  ReminderSequence,
  Reminder,
  ReminderIntent,
  InterruptionPriority,
  ReminderProfile,
} from './types';
import type { ReminderPolicy } from './policies/ReminderPolicy';

export class SequenceFactory {
  constructor(
    private clock: Clock,
    private snapshotAssembler: ReminderSnapshotAssembler,
  ) {}

  buildSequence(
    entity: any,
    entityType: string,
    offsets: readonly number[],
    profile: ReminderProfile,
    expiresAt?: Date | null,
    eventTime?: Date | null,
  ): ReminderSequence {
    const now = this.clock.now();
    const entityId = this._id(entity);
    const snapshot = this.snapshotAssembler.build(entity, entityType);
    const seqId = `${entityType}::${entityId}`;

    const baseTime = eventTime ?? now;

    const reminders: Reminder[] = [];
    for (let i = 0; i < offsets.length; i++) {
      const offsetMinutes = offsets[i];
      const scheduledAt = new Date(baseTime.getTime() + offsetMinutes * 60000);
      const intent = this._determineIntent(entityType, offsetMinutes);
      const priority = this._determinePriority(entityType, entity, offsetMinutes, now);
      const id = `${entityType}::${entityId}::${i}`;
      const subjectId = entity?.subjectId ?? entity?.subject_id ?? undefined;

      reminders.push({
        id,
        entityType,
        entityId,
        snapshot,
        subjectId,
        scheduledAt,
        intent,
        profile,
        priority,
        sequenceId: seqId,
        ordinal: i,
        status: 'pending',
      });
    }

    reminders.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    const resolvedExpiresAt = expiresAt !== undefined ? expiresAt : null;

    return Object.freeze({
      id: seqId,
      entityType,
      entityId,
      reminders: Object.freeze(reminders.map(r => Object.freeze(r))),
      createdAt: now,
      expiresAt: resolvedExpiresAt,
      status: reminders.length === 0 ? 'expired' : 'active',
    });
  }

  private _id(entity: any): string {
    if (entity == null) return '';
    return String(entity.id ?? entity.ID ?? '');
  }

  private _determineIntent(entityType: string, offsetMinutes: number): ReminderIntent {
    if (offsetMinutes <= 0) {
      switch (entityType) {
        case 'assessment':
          return 'prepare_exam';
        case 'schedule':
        case 'class':
          return 'attend_class';
        case 'review':
        case 'flashcard_deck':
        case 'flashcard':
          return 'review_cards';
        case 'grading_period':
          return 'submit_work';
        default:
          return 'follow_up';
      }
    }
    return 'follow_up';
  }

  private _determinePriority(
    entityType: string,
    entity: any,
    offsetMinutes: number,
    now: Date,
  ): InterruptionPriority {
    if (entityType === 'assessment') {
      const eventDate = entity?.date ?? entity?.startDate ?? entity?.dueDate;
      if (eventDate) {
        const eventTime = new Date(eventDate).getTime();
        const scheduledTime = now.getTime() + offsetMinutes * 60000;
        const hoursUntilEvent = (eventTime - scheduledTime) / 3600000;
        if (hoursUntilEvent <= 24) return 'critical';
      }
      return 'high';
    }
    return 'normal';
  }

}
