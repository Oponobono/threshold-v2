import { AssessmentPolicy } from '../../policies/AssessmentPolicy';
import { ReminderSnapshot } from '../../types';
import type { ReminderProfile, Reminder } from '../../types';

describe('AssessmentPolicy', () => {
  const policy = new AssessmentPolicy();

  describe('entityType', () => {
    it('es assessment', () => {
      expect(policy.entityType).toBe('assessment');
    });
  });

  describe('defaultProfile', () => {
    it('es standard con offsets por defecto', () => {
      expect(policy.defaultProfile.name).toBe('standard');
      expect(policy.defaultProfile.defaultOffsets).toEqual([-10080, -4320, -1440, -60, 0]);
    });
  });

  describe('getOffsets', () => {
    it('standard → [-10080, -4320, -1440, -60, 0]', () => {
      const profile: ReminderProfile = { name: 'standard', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-10080, -4320, -1440, -60, 0]);
    });

    it('minimal → [-1440, 0]', () => {
      const profile: ReminderProfile = { name: 'minimal', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-1440, 0]);
    });

    it('persistent → [-10080, -4320, -1440, -60, 0, 60, 1440]', () => {
      const profile: ReminderProfile = { name: 'persistent', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([-10080, -4320, -1440, -60, 0, 60, 1440]);
    });

    it('customOffsets sobrescribe los offsets por defecto', () => {
      const profile: ReminderProfile = {
        name: 'standard',
        defaultOffsets: [],
        customOffsets: [-10, 0],
      };
      expect(policy.getOffsets({}, profile)).toEqual([-10, 0]);
    });

    it('customOffsets vacío no sobrescribe', () => {
      const profile: ReminderProfile = {
        name: 'standard',
        defaultOffsets: [],
        customOffsets: [],
      };
      expect(policy.getOffsets({}, profile)).toEqual([-10080, -4320, -1440, -60, 0]);
    });
  });

  describe('shouldCancel', () => {
    const makeSequence = () =>
      ({ id: 'test', entityType: 'assessment', entityId: 'a1', reminders: [], createdAt: new Date(), expiresAt: null, status: 'active' } as any);

    it('status active → false', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'active' })).toBe(false);
    });

    it('status cancelled → true', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'cancelled' })).toBe(true);
    });

    it('status completed → true', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'completed' })).toBe(true);
    });

    it('sin status → false', () => {
      expect(policy.shouldCancel(makeSequence(), {})).toBe(false);
    });
  });

  describe('shouldCancelReminder', () => {
    const makeReminder = (overrides: Partial<Reminder> = {}): Reminder =>
      ({ id: 'r1', entityType: 'assessment', entityId: 'a1', scheduledAt: new Date(), intent: 'prepare_exam', profile: { name: 'standard', defaultOffsets: [] }, priority: 'high', sequenceId: 's1', ordinal: 0, status: 'pending', snapshot: new ReminderSnapshot({ entity: { id: 'a1', type: 'assessment', name: '' } }), ...overrides });

    it('entidad activa → false', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'active' })).toBe(false);
    });

    it('entidad cancelled → true', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'cancelled' })).toBe(true);
    });

    it('entidad completed → true', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'completed' })).toBe(true);
    });
  });

  describe('getExpiration', () => {
    it('date → date + 1 hour', () => {
      const exp = policy.getExpiration({ date: '2026-07-15T10:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-15T11:00:00.000Z');
    });

    it('startDate → startDate + 1 hour', () => {
      const exp = policy.getExpiration({ startDate: '2026-07-20T14:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-20T15:00:00.000Z');
    });

    it('dueDate → dueDate + 1 hour', () => {
      const exp = policy.getExpiration({ dueDate: '2026-07-25T23:59:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-26T00:59:00.000Z');
    });

    it('sin fecha → null', () => {
      expect(policy.getExpiration({})).toBeNull();
    });
  });
});
