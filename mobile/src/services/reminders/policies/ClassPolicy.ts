import { ReminderPolicy } from './ReminderPolicy';
import type { ReminderProfile, ReminderSequence, Reminder } from '../types';

const STANDARD_OFFSETS: readonly number[] = [-30, -5, 0];
const MINIMAL_OFFSETS: readonly number[] = [-5];
const PERSISTENT_OFFSETS: readonly number[] = [-60, -30, -5, 0, 10, 20];

const DEFAULT_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: STANDARD_OFFSETS,
};

export class ClassPolicy implements ReminderPolicy {
  readonly entityType = 'schedule';
  readonly defaultProfile = DEFAULT_PROFILE;

  getOffsets(entity: any, profile: ReminderProfile): readonly number[] {
    if (profile.customOffsets && profile.customOffsets.length > 0) {
      return profile.customOffsets;
    }
    switch (profile.name) {
      case 'minimal':
        return MINIMAL_OFFSETS;
      case 'persistent':
        return PERSISTENT_OFFSETS;
      case 'standard':
      default:
        return STANDARD_OFFSETS;
    }
  }

  shouldCancel(sequence: ReminderSequence, entity: any): boolean {
    const status = entity?.status;
    return status === 'cancelled';
  }

  shouldCancelReminder(reminder: Reminder, entity: any): boolean {
    if (entity?.status === 'cancelled') {
      return true;
    }
    return false;
  }

  getExpiration(entity: any, now?: Date): Date | null {
    const eventTime = this.getEventTime(entity, now);
    if (!eventTime) return null;
    const endTimeStr = entity?.end_time;
    if (!endTimeStr) return new Date(eventTime.getTime() + 3600000);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);
    const endTotalMinutes = endHour * 60 + endMinute;
    const startTotalMinutes = eventTime.getHours() * 60 + eventTime.getMinutes();
    const durationMs = (endTotalMinutes - startTotalMinutes) * 60000;
    if (durationMs <= 0) return new Date(eventTime.getTime() + 3600000);
    return new Date(eventTime.getTime() + durationMs);
  }

  getEventTime(entity: any, now?: Date): Date | null {
    const dayOfWeek = entity?.day_of_week;
    const startTime = entity?.start_time;
    if (!dayOfWeek || !startTime) return null;

    const [hour, minute] = startTime.split(':').map(Number);
    if (isNaN(hour) || isNaN(minute)) return null;

    const nowDate = now ?? new Date();
    const currentDay = nowDate.getDay();
    const jsDay = dayOfWeek === 7 ? 0 : dayOfWeek;

    let daysUntil = jsDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && (nowDate.getHours() > hour || (nowDate.getHours() === hour && nowDate.getMinutes() >= minute)))) {
      daysUntil += 7;
    }

    const nextOccurrence = new Date(nowDate);
    nextOccurrence.setDate(nowDate.getDate() + daysUntil);
    nextOccurrence.setHours(hour, minute, 0, 0);

    return nextOccurrence;
  }
}
