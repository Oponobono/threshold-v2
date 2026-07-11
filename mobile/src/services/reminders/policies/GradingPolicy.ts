import { ReminderPolicy } from './ReminderPolicy';
import type { ReminderProfile, ReminderSequence, Reminder } from '../types';

const STANDARD_OFFSETS: readonly number[] = [-10080, -1440, 0];
const MINIMAL_OFFSETS: readonly number[] = [-1440, 0];
const PERSISTENT_OFFSETS: readonly number[] = [-10080, -4320, -1440, -60, 0];

const DEFAULT_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: STANDARD_OFFSETS,
};

export class GradingPolicy implements ReminderPolicy {
  readonly entityType = 'grading_period';
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
    return status === 'closed' || status === 'cancelled';
  }

  shouldCancelReminder(reminder: Reminder, entity: any): boolean {
    const status = entity?.status;
    if (status === 'closed' || status === 'cancelled') {
      return true;
    }
    return false;
  }

  getExpiration(entity: any): Date | null {
    const closeDate = entity?.closeDate ?? entity?.close_date ?? entity?.endDate;
    if (!closeDate) return null;
    return new Date(new Date(closeDate).getTime() + 86400000);
  }
}
