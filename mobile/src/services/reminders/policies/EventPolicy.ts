import { ReminderPolicy } from './ReminderPolicy';
import { parseReminderDate } from '../date/parseReminderDate';
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

  /**
   * S2.2 — evento de día completo (all-day) NO genera recordatorio. El usuario
   * no pidió ser avisado de un día completo; los offsets pierden sentido
   * (start_at no tiene hora). No se infiere all-day de los timestamps.
   */
  private _isAllDay(entity: any): boolean {
    if (entity == null) return false;
    if (entity.is_all_day != null) return !!entity.is_all_day;
    if (entity.all_day != null) return !!entity.all_day;
    if (entity.allDay != null) return !!entity.allDay;
    return false;
  }

  shouldCancel(sequence: ReminderSequence, entity: any): boolean {
    return entity?.status === 'cancelled' || this._isAllDay(entity);
  }

  shouldCancelReminder(reminder: Reminder, entity: any): boolean {
    return entity?.status === 'cancelled' || this._isAllDay(entity);
  }

  getExpiration(entity: any): Date | null {
    const endDate = entity?.end_date ?? entity?.endDate;
    if (!endDate) return null;
    const parsed = parseReminderDate(endDate);
    if (!parsed) return null;
    return new Date(parsed.getTime() + 1800000);
  }

  getEventTime(entity: any): Date | null {
    if (this._isAllDay(entity)) return null;
    const startDate = entity?.start_date ?? entity?.startDate;
    if (!startDate) return null;
    return parseReminderDate(startDate);
  }
}
