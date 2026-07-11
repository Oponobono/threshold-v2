import { ClassPolicy } from '../../policies/ClassPolicy';
import type { ReminderProfile, Reminder } from '../../types';

describe('ClassPolicy', () => {
  const policy = new ClassPolicy();

  describe('entityType', () => {
    it('es schedule', () => {
      expect(policy.entityType).toBe('schedule');
    });
  });

  describe('defaultProfile', () => {
    it('es standard con offsets por defecto', () => {
      expect(policy.defaultProfile.name).toBe('standard');
      expect(policy.defaultProfile.defaultOffsets).toEqual([-30, -5, 0]);
    });
  });

  describe('getOffsets', () => {
    it('standard → [-30, -5, 0]', () => {
      const profile: ReminderProfile = { name: 'standard', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-30, -5, 0]);
    });

    it('minimal → [-5]', () => {
      const profile: ReminderProfile = { name: 'minimal', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-5]);
    });

    it('persistent → [-60, -30, -5, 0, 10, 20]', () => {
      const profile: ReminderProfile = { name: 'persistent', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-60, -30, -5, 0, 10, 20]);
    });

    it('customOffsets sobrescribe', () => {
      const profile: ReminderProfile = { name: 'standard', defaultOffsets: [], customOffsets: [-15] };
      expect(policy.getOffsets({}, profile)).toEqual([-15]);
    });
  });

  describe('shouldCancel', () => {
    const seq = () => ({ id: 's1', entityType: 'schedule', entityId: 's1', reminders: [], createdAt: new Date(), expiresAt: null, status: 'active' } as any);

    it('status active → false', () => {
      expect(policy.shouldCancel(seq(), { status: 'active' })).toBe(false);
    });

    it('status cancelled → true', () => {
      expect(policy.shouldCancel(seq(), { status: 'cancelled' })).toBe(true);
    });
  });

  describe('getExpiration', () => {
    it('endTime → endTime + 30 min', () => {
      const exp = policy.getExpiration({ endTime: '2026-07-10T13:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-10T13:30:00.000Z');
    });

    it('end_date → end_date + 30 min', () => {
      const exp = policy.getExpiration({ end_date: '2026-07-10T14:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-10T14:30:00.000Z');
    });

    it('sin endTime → null', () => {
      expect(policy.getExpiration({})).toBeNull();
    });
  });
});
