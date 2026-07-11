import { ReminderPolicy } from './ReminderPolicy';
import type { ReminderProfile, ReminderSequence, Reminder } from '../types';

const STANDARD_OFFSETS: readonly number[] = [-60, 0];
const MINIMAL_OFFSETS: readonly number[] = [-15];
const PERSISTENT_OFFSETS: readonly number[] = [-1440, -60, -15, 0];

const DEFAULT_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: STANDARD_OFFSETS,
};

export class EventPolicy implements ReminderPolicy {
  readonly entityType = 'calendar_event';
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

  getExpiration(entity: any): Date | null {
    const endDate = entity?.endDate ?? entity?.end_date ?? entity?.end;
    if (!endDate) return null;
    return new Date(new Date(endDate).getTime() + 1800000);
  }
}
