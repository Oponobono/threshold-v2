import { PolicyRegistry } from '../../policies/PolicyRegistry';
import { AssessmentPolicy } from '../../policies/AssessmentPolicy';
import { ClassPolicy } from '../../policies/ClassPolicy';
import { EventPolicy } from '../../policies/EventPolicy';
import { ReviewPolicy } from '../../policies/ReviewPolicy';
import { GradingPolicy } from '../../policies/GradingPolicy';
import { SequenceFactory } from '../../SequenceFactory';
import { ReminderSnapshotAssembler } from '../../ReminderSnapshotAssembler';
import { FakeClock } from '../../Clock';
import type { ReminderProfile, ReminderSequence } from '../../types';

const assembler = new ReminderSnapshotAssembler();

const ANCHOR = new Date('2026-07-10T12:00:00Z');

function createRegistry(): PolicyRegistry {
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new EventPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new GradingPolicy());
  return registry;
}

function buildSequence(
  registry: PolicyRegistry,
  factory: SequenceFactory,
  entityType: string,
  entity: any,
  profileName: ReminderProfile['name'] = 'standard',
): ReminderSequence {
  const policy = registry.get(entityType);
  const profile: ReminderProfile = {
    name: profileName,
    defaultOffsets: policy.defaultProfile.defaultOffsets,
  };
  const offsets = policy.getOffsets(entity, profile);
  const expiresAt = policy.getExpiration(entity);
  return factory.buildSequence(entity, entityType, offsets, profile, expiresAt);
}

describe('Integration: Registry → Policy → Factory → Sequence', () => {
  describe('cadena completa para Assessment', () => {
    it('produce secuencia con 5 reminders en standard', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'a-1', date: '2026-07-15T10:00:00Z', status: 'active', subjectId: 'subj-1' };
      const seq = buildSequence(registry, factory, 'assessment', entity);

      expect(seq.entityType).toBe('assessment');
      expect(seq.entityId).toBe('a-1');
      expect(seq.reminders).toHaveLength(5);
      expect(seq.status).toBe('active');
      expect(seq.id).toBe('assessment::a-1');
    });

    it('primer reminder: -10080 min → prepare_exam, high', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'a-1', date: '2026-07-15T10:00:00Z', status: 'active', subjectId: 'subj-1' };
      const seq = buildSequence(registry, factory, 'assessment', entity);
      const r = seq.reminders[0];

      expect(r.scheduledAt.getTime()).toBe(ANCHOR.getTime() - 10080 * 60000);
      expect(r.intent).toBe('prepare_exam');
      expect(r.priority).toBe('high');
      expect(r.ordinal).toBe(0);
    });

    it('expiresAt = assessment date + 1h', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'a-1', date: '2026-07-15T10:00:00Z', status: 'active' };
      const seq = buildSequence(registry, factory, 'assessment', entity);

      expect(seq.expiresAt!.toISOString()).toBe('2026-07-15T11:00:00.000Z');
    });

    it('profile persistent produce 7 reminders', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'a-1', date: '2026-07-15T10:00:00Z', status: 'active' };
      const seq = buildSequence(registry, factory, 'assessment', entity, 'persistent');

      expect(seq.reminders).toHaveLength(7);
      expect(seq.reminders[6].intent).toBe('follow_up');
    });

    it('profile minimal produce 2 reminders', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'a-1', date: '2026-07-15T10:00:00Z', status: 'active' };
      const seq = buildSequence(registry, factory, 'assessment', entity, 'minimal');

      expect(seq.reminders).toHaveLength(2);
    });
  });

  describe('cadena completa para Schedule', () => {
    it('produce secuencia con 3 reminders en standard', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 's-1', endTime: '2026-07-10T13:00:00Z', status: 'active' };
      const seq = buildSequence(registry, factory, 'schedule', entity);

      expect(seq.reminders).toHaveLength(3);
      expect(seq.entityType).toBe('schedule');
      expect(seq.reminders[0].intent).toBe('attend_class');
      expect(seq.reminders[0].priority).toBe('normal');
    });

    it('expiresAt = endTime + 30min', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 's-1', endTime: '2026-07-10T13:00:00Z', status: 'active' };
      const seq = buildSequence(registry, factory, 'schedule', entity);

      expect(seq.expiresAt!.toISOString()).toBe('2026-07-10T13:30:00.000Z');
    });
  });

  describe('cadena completa para FlashcardDeck', () => {
    it('produce secuencia con 1 reminder en standard', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'd-1', dueCardsCount: 10, status: 'active' };
      const seq = buildSequence(registry, factory, 'flashcard_deck', entity);

      expect(seq.reminders).toHaveLength(1);
      expect(seq.reminders[0].intent).toBe('review_cards');
      expect(seq.expiresAt).toBeNull();
    });

    it('shouldCancel detecta dueCardsCount = 0', () => {
      const registry = createRegistry();
      const policy = registry.get('flashcard_deck');
      const entity = { id: 'd-1', dueCardsCount: 0, status: 'active' };
      const seq = buildSequence(registry, new SequenceFactory(new FakeClock(ANCHOR), new ReminderSnapshotAssembler()), 'flashcard_deck', entity);

      expect(policy.shouldCancel(seq, entity)).toBe(true);
    });
  });

  describe('cadena completa para GradingPeriod', () => {
    it('produce secuencia con 3 reminders en standard', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'g-1', closeDate: '2026-08-01T00:00:00Z', status: 'active' };
      const seq = buildSequence(registry, factory, 'grading_period', entity);

      expect(seq.reminders).toHaveLength(3);
      expect(seq.reminders[0].intent).toBe('submit_work');
      expect(seq.expiresAt!.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    });
  });

  describe('cadena completa para CalendarEvent', () => {
    it('produce secuencia con 2 reminders en standard', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'e-1', endDate: '2026-07-10T14:00:00Z', status: 'active' };
      const seq = buildSequence(registry, factory, 'calendar_event', entity);

      expect(seq.reminders).toHaveLength(2);
      expect(seq.reminders[0].intent).toBe('follow_up');
      expect(seq.expiresAt!.toISOString()).toBe('2026-07-10T14:30:00.000Z');
    });
  });

  describe('reglas de cancelación desde el Registry', () => {
    it('Assessment cancelled → shouldCancel true', () => {
      const registry = createRegistry();
      const policy = registry.get('assessment');
      const entity = { id: 'a-1', status: 'cancelled' };
      const seq: ReminderSequence = {
        id: 'a-1', entityType: 'assessment', entityId: 'a-1',
        reminders: [], createdAt: ANCHOR, expiresAt: null, status: 'active',
      };
      expect(policy.shouldCancel(seq, entity)).toBe(true);
    });

    it('GradingPeriod closed → shouldCancel true', () => {
      const registry = createRegistry();
      const policy = registry.get('grading_period');
      const entity = { id: 'g-1', status: 'closed' };
      const seq: ReminderSequence = {
        id: 'g-1', entityType: 'grading_period', entityId: 'g-1',
        reminders: [], createdAt: ANCHOR, expiresAt: null, status: 'active',
      };
      expect(policy.shouldCancel(seq, entity)).toBe(true);
    });
  });

  describe('determinismo cross-entity', () => {
    it('mismos parámetros → mismo sequence', () => {
      const clock = new FakeClock(ANCHOR);
      const registry = createRegistry();
      const factory = new SequenceFactory(clock, assembler);

      const entity = { id: 'x', date: '2026-07-15T10:00:00Z', status: 'active' };

      const s1 = buildSequence(registry, factory, 'assessment', entity);
      const s2 = buildSequence(registry, factory, 'assessment', entity);

      expect(s1.id).toBe(s2.id);
      expect(s1.reminders.map(r => r.id)).toEqual(s2.reminders.map(r => r.id));
    });
  });
});
