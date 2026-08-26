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

    it('exam activo con starts_at → false', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'active', assessment_type: 'exam', starts_at: '2026-07-15T10:00:00Z' })).toBe(false);
    });

    it('exam activo sin starts_at pero con date → false (fallback a date)', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'active', assessment_type: 'exam', date: '2026-07-15' })).toBe(false);
    });

    it('deadline activo sin due_at pero con date → false (fallback a date)', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'active', assessment_type: 'deadline', date: '2026-07-15' })).toBe(false);
    });

    it('status cancelled → true', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'cancelled', assessment_type: 'exam', starts_at: '2026-07-15T10:00:00Z' })).toBe(true);
    });

    it('status completed → true', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'completed', assessment_type: 'exam', starts_at: '2026-07-15T10:00:00Z' })).toBe(true);
    });

    it('sin ancla temporal ni date (sin assessment_type) → true', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'active' })).toBe(true);
    });

    it('assessment_type sin campo temporal ni date → true', () => {
      expect(policy.shouldCancel(makeSequence(), { status: 'active', assessment_type: 'exam' })).toBe(true);
    });
  });

  describe('shouldCancelReminder', () => {
    const makeReminder = (overrides: Partial<Reminder> = {}): Reminder =>
      ({ id: 'r1', entityType: 'assessment', entityId: 'a1', scheduledAt: new Date(), intent: 'prepare_exam', profile: { name: 'standard', defaultOffsets: [] }, priority: 'high', sequenceId: 's1', ordinal: 0, status: 'pending', snapshot: new ReminderSnapshot({ entity: { id: 'a1', type: 'assessment', name: '' } }), ...overrides });

    it('entidad activa con ancla → false', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'active', assessment_type: 'exam', starts_at: '2026-07-15T10:00:00Z' })).toBe(false);
    });

    it('entidad activa sin starts_at pero con date → false (fallback)', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'active', assessment_type: 'exam', date: '2026-07-15' })).toBe(false);
    });

    it('entidad cancelled → true', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'cancelled', assessment_type: 'exam', starts_at: '2026-07-15T10:00:00Z' })).toBe(true);
    });

    it('entidad completed → true', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'completed', assessment_type: 'exam', starts_at: '2026-07-15T10:00:00Z' })).toBe(true);
    });

    it('sin ancla temporal ni date → true', () => {
      expect(policy.shouldCancelReminder(makeReminder(), { status: 'active' })).toBe(true);
    });
  });

  describe('getExpiration', () => {
    it('exam con starts_at → starts_at + 1 hour', () => {
      const exp = policy.getExpiration({ assessment_type: 'exam', starts_at: '2026-07-15T10:00:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-15T11:00:00.000Z');
    });

    it('deadline con due_at → due_at + 1 hour', () => {
      const exp = policy.getExpiration({ assessment_type: 'deadline', due_at: '2026-07-25T23:59:00Z' });
      expect(exp!.toISOString()).toBe('2026-07-26T00:59:00.000Z');
    });

    it('sin starts_at pero con date → date + 1 hour (fallback)', () => {
      const exp = policy.getExpiration({ assessment_type: 'exam', date: '2026-07-15' });
      expect(exp).not.toBeNull();
      expect(exp!.getDate()).toBe(15);
    });

    it('sin ancla ni date → null', () => {
      expect(policy.getExpiration({})).toBeNull();
    });
  });
});
