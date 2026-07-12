import { GradingPolicy } from '../../policies/GradingPolicy';
import { ReminderSnapshot } from '../../types';
import type { ReminderProfile, Reminder } from '../../types';

describe('GradingPolicy', () => {
  const policy = new GradingPolicy();

  describe('entityType', () => {
    it('es grading_period', () => {
      expect(policy.entityType).toBe('grading_period');
    });
  });

  describe('getOffsets', () => {
    it('standard → [-10080, -1440, 0]', () => {
      const profile: ReminderProfile = { name: 'standard', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-10080, -1440, 0]);
    });

    it('minimal → [-1440, 0]', () => {
      const profile: ReminderProfile = { name: 'minimal', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-1440, 0]);
    });

    it('persistent → [-10080, -4320, -1440, -60, 0]', () => {
      const profile: ReminderProfile = { name: 'persistent', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-10080, -4320, -1440, -60, 0]);
    });
  });

  describe('shouldCancel', () => {
    const seq = () => ({ id: 's1', entityType: 'grading_period', entityId: 'g1', reminders: [], createdAt: new Date(), expiresAt: null, status: 'active' } as any);

    it('status active → false', () => {
      expect(policy.shouldCancel(seq(), { status: 'active' })).toBe(false);
    });

    it('status closed → true', () => {
      expect(policy.shouldCancel(seq(), { status: 'closed' })).toBe(true);
    });

    it('status cancelled → true', () => {
      expect(policy.shouldCancel(seq(), { status: 'cancelled' })).toBe(true);
    });
  });

  describe('shouldCancelReminder', () => {
    const r = (): Reminder => ({ id: 'r1', entityType: 'grading_period', entityId: 'g1', scheduledAt: new Date(), intent: 'submit_work', profile: { name: 'standard', defaultOffsets: [] }, priority: 'normal', sequenceId: 's1', ordinal: 0, status: 'pending', snapshot: new ReminderSnapshot({ entity: { id: 'g1', type: 'grading_period', name: '' } }) });

    it('status active → false', () => {
      expect(policy.shouldCancelReminder(r(), { status: 'active' })).toBe(false);
    });

    it('status closed → true', () => {
      expect(policy.shouldCancelReminder(r(), { status: 'closed' })).toBe(true);
    });
  });

  describe('getExpiration', () => {
    it('closeDate → closeDate + 24h', () => {
      const exp = policy.getExpiration({ closeDate: '2026-07-31T23:59:00Z' });
      expect(exp!.toISOString()).toBe('2026-08-01T23:59:00.000Z');
    });

    it('close_date → close_date + 24h', () => {
      const exp = policy.getExpiration({ close_date: '2026-08-15T12:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-08-16T12:00:00.000Z');
    });

    it('endDate también funciona', () => {
      const exp = policy.getExpiration({ endDate: '2026-06-30T00:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });

    it('sin fecha → null', () => {
      expect(policy.getExpiration({})).toBeNull();
    });
  });
});
