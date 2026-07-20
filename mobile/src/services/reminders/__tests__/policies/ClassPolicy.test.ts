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

  describe('getEventTime', () => {
    it('day_of_week + start_time → Date', () => {
      const entity = { day_of_week: 2, start_time: '06:00' };
      const result = policy.getEventTime!(entity);
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(6);
      expect(result!.getMinutes()).toBe(0);
    });

    it('sin day_of_week → null', () => {
      expect(policy.getEventTime!({ start_time: '06:00' })).toBeNull();
    });

    it('sin start_time → null', () => {
      expect(policy.getEventTime!({ day_of_week: 2 })).toBeNull();
    });
  });

  describe('getExpiration', () => {
    it('day_of_week + start_time + end_time → start + duration', () => {
      const entity = { day_of_week: 2, start_time: '06:00', end_time: '08:00' };
      const exp = policy.getExpiration(entity);
      expect(exp).not.toBeNull();
      const eventTime = policy.getEventTime!(entity)!;
      const durationMs = exp!.getTime() - eventTime.getTime();
      expect(durationMs).toBe(2 * 3600000);
    });

    it('sin start_time → null', () => {
      expect(policy.getExpiration({})).toBeNull();
    });

    it('sin end_time → fallback 1h', () => {
      const entity = { day_of_week: 2, start_time: '06:00' };
      const exp = policy.getExpiration(entity);
      expect(exp).not.toBeNull();
      const eventTime = policy.getEventTime!(entity)!;
      const durationMs = exp!.getTime() - eventTime.getTime();
      expect(durationMs).toBe(3600000);
    });
  });
});
