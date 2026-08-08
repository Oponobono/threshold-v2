import { ReminderPolicy } from './ReminderPolicy';
import { resolveAssessmentAnchor } from '../../domain/assessmentTemporal';
import type { ReminderProfile, ReminderSequence, Reminder } from '../types';

const STANDARD_OFFSETS: readonly number[] = [-10080, -4320, -1440, -60, 0];
const MINIMAL_OFFSETS: readonly number[] = [-1440, 0];
const PERSISTENT_OFFSETS: readonly number[] = [-10080, -4320, -1440, -60, 0, 60, 1440];

const DEFAULT_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: STANDARD_OFFSETS,
};

export class AssessmentPolicy implements ReminderPolicy {
  readonly entityType = 'assessment';
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
    return status === 'cancelled' || status === 'completed' || !resolveAssessmentAnchor(entity);
  }

  shouldCancelReminder(reminder: Reminder, entity: any): boolean {
    if (entity?.status === 'cancelled' || entity?.status === 'completed') {
      return true;
    }
    return !resolveAssessmentAnchor(entity);
  }

  /**
   * S2.1 — el ancla temporal es decisión del DOMINIO (assessmentTemporal.ts),
   * no de la política. exam → starts_at; deadline → due_at; sin ancla → null.
   * Sin fallback a `date`/medianoche: un assessment sin ancla no genera recordatorio.
   */
  getExpiration(entity: any): Date | null {
    const anchor = resolveAssessmentAnchor(entity);
    if (!anchor) return null;
    return new Date(anchor.anchor.getTime() + 3600000);
  }

  getEventTime(entity: any): Date | null {
    const anchor = resolveAssessmentAnchor(entity);
    if (!anchor) return null;
    return anchor.anchor;
  }
}
