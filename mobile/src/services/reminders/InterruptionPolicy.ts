import type { Clock } from './Clock';
import type { ReminderSequence, DeliveryPlan, DeliveryReminderDomain, InterruptionPriority } from './types';

const PRIORITY_ORDER: InterruptionPriority[] = ['critical', 'high', 'normal', 'low'];

const SIMULTANEOUS_LIMIT = 3;
const SHIFT_MINUTES = 5;
const GROUP_WINDOW_MINUTES = 5;

export class InterruptionPolicy {
  private planCounter = 0;
  private _activeStudy = false;

  constructor(private clock: Clock) {}

  setActiveStudy(active: boolean): void {
    this._activeStudy = active;
  }

  resolve(
    sequences: readonly ReminderSequence[],
    suppressReview?: boolean,
  ): DeliveryPlan {
    const now = this.clock.now();
    const all = this._collect(sequences, suppressReview ?? this._activeStudy, now);
    const resolved = this._resolveCollisions(all);
    const deliverables = this._applySimultaneousLimit(resolved);

    this.planCounter++;

    const planId = 'plan-' + now.getTime().toString() + '-' + this.planCounter.toString();

    return {
      planId,
      version: this.planCounter,
      generatedAt: now,
      deliverables,
    };
  }

  resetCounter(): void {
    this.planCounter = 0;
  }

  private _collect(
    sequences: readonly ReminderSequence[],
    suppressReview: boolean,
    now: Date,
  ): DeliveryReminderDomain[] {
    const result: DeliveryReminderDomain[] = [];

    for (const seq of sequences) {
      if (seq.status === 'expired' || seq.status === 'cancelled' || seq.status === 'completed') {
        continue;
      }

      if (seq.expiresAt && seq.expiresAt.getTime() < now.getTime()) {
        continue;
      }

      for (const reminder of seq.reminders) {
        if (reminder.status === 'superseded') {
          continue;
        }
        if (reminder.scheduledAt.getTime() < now.getTime()) {
          continue;
        }

        if (suppressReview && reminder.intent === 'review_cards') {
          continue;
        }

        if (reminder.status === 'delivered') {
          continue;
        }

        result.push({
          id: reminder.id,
          scheduledAt: reminder.scheduledAt,
          entityType: reminder.entityType,
          entityId: reminder.entityId,
          subjectId: reminder.subjectId,
          intent: reminder.intent,
          priority: reminder.priority,
        });
      }
    }

    return result;
  }

  private _resolveCollisions(
    reminders: DeliveryReminderDomain[],
  ): DeliveryReminderDomain[] {
    const sorted = [...reminders].sort(
      (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime(),
    );

    if (sorted.length === 0) return [];

    const earliestTime = sorted[0].scheduledAt.getTime();

    const groupMap = new Map<number, DeliveryReminderDomain[]>();

    for (const r of sorted) {
      const minutesFromEarliest = Math.floor(
        (r.scheduledAt.getTime() - earliestTime) / 60000,
      );
      const groupKey = Math.floor(minutesFromEarliest / GROUP_WINDOW_MINUTES);

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(r);
    }

    const result: DeliveryReminderDomain[] = [];

    for (const group of groupMap.values()) {
      const resolved = this._resolveGroup(group);
      result.push(...resolved);
    }

    result.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    return result;
  }

  private _resolveGroup(
    group: DeliveryReminderDomain[],
  ): DeliveryReminderDomain[] {
    const sorted = [...group].sort(
      (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
    );

    const result: DeliveryReminderDomain[] = [sorted[0]];
    const baseTime = sorted[0].scheduledAt.getTime();

    for (let i = 1; i < Math.min(sorted.length, SIMULTANEOUS_LIMIT); i++) {
      const offsetReminder: DeliveryReminderDomain = {
        ...sorted[i],
        scheduledAt: new Date(baseTime + i * SHIFT_MINUTES * 60000),
      };
      result.push(offsetReminder);
    }

    return result;
  }

  private _applySimultaneousLimit(
    reminders: DeliveryReminderDomain[],
  ): DeliveryReminderDomain[] {
    return reminders.slice(0, SIMULTANEOUS_LIMIT);
  }
}
