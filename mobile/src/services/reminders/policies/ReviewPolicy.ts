import { ReminderPolicy } from './ReminderPolicy';
import type { ReminderProfile, ReminderSequence, Reminder } from '../types';

const STANDARD_OFFSETS: readonly number[] = [0];
const MINIMAL_OFFSETS: readonly number[] = [0];
const PERSISTENT_OFFSETS: readonly number[] = [0, 60, 1440];

const DEFAULT_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: STANDARD_OFFSETS,
};

export class ReviewPolicy implements ReminderPolicy {
  readonly entityType = 'flashcard_deck';
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
    return entity?.dueCardsCount != null && entity.dueCardsCount <= 0;
  }

  shouldCancelReminder(reminder: Reminder, entity: any): boolean {
    if (entity?.dueCardsCount != null && entity.dueCardsCount <= 0) {
      return true;
    }
    return false;
  }

  getExpiration(entity: any): Date | null {
    return null;
  }
}
