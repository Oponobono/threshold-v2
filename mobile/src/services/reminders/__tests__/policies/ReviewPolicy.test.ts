import { ReviewPolicy } from '../../policies/ReviewPolicy';
import { ReminderSnapshot } from '../../types';
import type { ReminderProfile, Reminder } from '../../types';

describe('ReviewPolicy', () => {
  const policy = new ReviewPolicy();

  describe('entityType', () => {
    it('es flashcard_deck', () => {
      expect(policy.entityType).toBe('flashcard_deck');
    });
  });

  describe('getOffsets', () => {
    it('standard → [0]', () => {
      const profile: ReminderProfile = { name: 'standard', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([0]);
    });

    it('minimal → [0]', () => {
      const profile: ReminderProfile = { name: 'minimal', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([0]);
    });

    it('persistent → [0, 60, 1440]', () => {
      const profile: ReminderProfile = { name: 'persistent', defaultOffsets: [] };
      expect(policy.getOffsets({}, profile)).toEqual([0, 60, 1440]);
    });
  });

  describe('shouldCancel', () => {
    const seq = () => ({ id: 's1', entityType: 'flashcard_deck', entityId: 'd1', reminders: [], createdAt: new Date(), expiresAt: null, status: 'active' } as any);

    it('dueCardsCount > 0 → false', () => {
      expect(policy.shouldCancel(seq(), { dueCardsCount: 5 })).toBe(false);
    });

    it('dueCardsCount = 0 → true', () => {
      expect(policy.shouldCancel(seq(), { dueCardsCount: 0 })).toBe(true);
    });

    it('dueCardsCount = null → false', () => {
      expect(policy.shouldCancel(seq(), {})).toBe(false);
    });
  });

  describe('shouldCancelReminder', () => {
    const r = (): Reminder => ({ id: 'r1', entityType: 'flashcard_deck', entityId: 'd1', scheduledAt: new Date(), intent: 'review_cards', profile: { name: 'standard', defaultOffsets: [] }, priority: 'normal', sequenceId: 's1', ordinal: 0, status: 'pending', snapshot: new ReminderSnapshot({ entity: { id: 'd1', type: 'flashcard_deck', name: '' } }) });

    it('dueCardsCount > 0 → false', () => {
      expect(policy.shouldCancelReminder(r(), { dueCardsCount: 3 })).toBe(false);
    });

    it('dueCardsCount = 0 → true', () => {
      expect(policy.shouldCancelReminder(r(), { dueCardsCount: 0 })).toBe(true);
    });
  });

  describe('getExpiration', () => {
    it('siempre null', () => {
      expect(policy.getExpiration({})).toBeNull();
      expect(policy.getExpiration({ dueCardsCount: 5 })).toBeNull();
    });
  });
});
