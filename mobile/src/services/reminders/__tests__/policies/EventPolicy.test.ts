import { EventPolicy } from '../../policies/EventPolicy';
import type { ReminderProfile } from '../../types';

describe('EventPolicy', () => {
  const policy = new EventPolicy();

  describe('entityType', () => {
    it('es calendar_event', () => {
      expect(policy.entityType).toBe('calendar_event');
    });
  });

  describe('getOffsets', () => {
    it('standard → [-60, 0]', () => {
      const profile: ReminderProfile = { name: 'standard', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-60, 0]);
    });

    it('minimal → [-15]', () => {
      const profile: ReminderProfile = { name: 'minimal', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-15]);
    });

    it('persistent → [-1440, -60, -15, 0]', () => {
      const profile: ReminderProfile = { name: 'persistent', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-1440, -60, -15, 0]);
    });
  });

  describe('shouldCancel', () => {
    const seq = () => ({ id: 's1', entityType: 'calendar_event', entityId: 'e1', reminders: [], createdAt: new Date(), expiresAt: null, status: 'active' } as any);

    it('status active → false', () => {
      expect(policy.shouldCancel(seq(), { status: 'active' })).toBe(false);
    });

    it('status cancelled → true', () => {
      expect(policy.shouldCancel(seq(), { status: 'cancelled' })).toBe(true);
    });
  });

  describe('getExpiration', () => {
    it('endDate → endDate + 30 min', () => {
      const exp = policy.getExpiration({ endDate: '2026-07-10T15:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-10T15:30:00.000Z');
    });

    it('end_date → end_date + 30 min', () => {
      const exp = policy.getExpiration({ end_date: '2026-07-10T16:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-10T16:30:00.000Z');
    });

    it('sin endDate → null', () => {
      expect(policy.getExpiration({})).toBeNull();
    });
  });

  describe('getExpiration / getEventTime con fechas DD-MM-YYYY', () => {
    it('getEventTime con startDate DD-MM-YYYY → fecha válida (día primero)', () => {
      const t = policy.getEventTime({ start_date: '09-07-2026' });
      expect(t).not.toBeNull();
      expect(t!.getFullYear()).toBe(2026);
      expect(t!.getMonth()).toBe(6);
      expect(t!.getDate()).toBe(9);
    });

    it('getExpiration con end_date DD-MM-YYYY → +30 min', () => {
      const exp = policy.getExpiration({ end_date: '09-07-2026' });
      expect(exp).not.toBeNull();
      expect(exp!.getFullYear()).toBe(2026);
      expect(exp!.getMonth()).toBe(6);
      expect(exp!.getDate()).toBe(9);
      expect(exp!.getHours()).toBe(0);
      expect(exp!.getMinutes()).toBe(30);
    });

    it('fecha DD-MM-YYYY inválida → null (sin NaN)', () => {
      expect(policy.getEventTime({ start_date: '32-07-2026' })).toBeNull();
      expect(policy.getExpiration({ end_date: '32-07-2026' })).toBeNull();
    });
  });
});
