import { ReminderProfile, ReminderSequence, Reminder } from '../types';

export interface ReminderPolicy {
  readonly entityType: string;
  readonly defaultProfile: ReminderProfile;

  getOffsets(entity: any, profile: ReminderProfile): readonly number[];

  shouldCancel(sequence: ReminderSequence, entity: any): boolean;

  shouldCancelReminder(reminder: Reminder, entity: any): boolean;

  getExpiration(entity: any, now?: Date): Date | null;

  getEventTime?(entity: any, now?: Date): Date | null;
}
