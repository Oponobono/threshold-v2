import { SequenceFactory } from '../SequenceFactory';
import { FakeClock } from '../Clock';
import type { ReminderProfile } from '../types';

const STANDARD_PROFILE: ReminderProfile = {
  name: 'standard',
  defaultOffsets: [-10080, -4320, -1440, -60, 0],
};

const ANCHOR = new Date('2026-07-10T12:00:00Z');

function makeEntity(overrides: Record<string, any> = {}): any {
  return { id: 'entity-1', subjectId: 'subj-1', ...overrides };
}

describe('SequenceFactory', () => {
  describe('IDs deterministas', () => {
    it('mismo input produce mismo sequence ID', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const entity = makeEntity();
      const seq1 = factory.buildSequence(entity, 'assessment', [-60, 0], STANDARD_PROFILE);
      const seq2 = factory.buildSequence(entity, 'assessment', [-60, 0], STANDARD_PROFILE);
      expect(seq1.id).toBe(seq2.id);
    });

    it('mismo input produce mismos reminder IDs', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const entity = makeEntity();
      const seq1 = factory.buildSequence(entity, 'assessment', [-60, 0], STANDARD_PROFILE);
      const seq2 = factory.buildSequence(entity, 'assessment', [-60, 0], STANDARD_PROFILE);
      expect(seq1.reminders.map(r => r.id)).toEqual(seq2.reminders.map(r => r.id));
    });

    it('IDs diferentes para distintas entidades', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const e1 = makeEntity({ id: 'e1' });
      const e2 = makeEntity({ id: 'e2' });
      const s1 = factory.buildSequence(e1, 'assessment', [-60], STANDARD_PROFILE);
      const s2 = factory.buildSequence(e2, 'assessment', [-60], STANDARD_PROFILE);
      expect(s1.id).not.toBe(s2.id);
      expect(s1.reminders[0].id).not.toBe(s2.reminders[0].id);
    });
  });

  describe('offsets', () => {
    it('reminders tienen scheduledAt = now + offset', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const entity = makeEntity();
      const seq = factory.buildSequence(entity, 'assessment', [-60, 0], STANDARD_PROFILE);
      expect(seq.reminders[0].scheduledAt.getTime()).toBe(
        ANCHOR.getTime() - 60 * 60 * 1000,
      );
      expect(seq.reminders[1].scheduledAt.getTime()).toBe(ANCHOR.getTime());
    });

    it('offsets positivos producen reminders futuros', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [60, 1440], STANDARD_PROFILE);
      expect(seq.reminders[0].scheduledAt.getTime()).toBe(
        ANCHOR.getTime() + 60 * 60 * 1000,
      );
      expect(seq.reminders[1].scheduledAt.getTime()).toBe(
        ANCHOR.getTime() + 1440 * 60 * 1000,
      );
    });

    it('ordena reminders cronológicamente', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [0, -60, -1440], STANDARD_PROFILE);
      for (let i = 1; i < seq.reminders.length; i++) {
        expect(seq.reminders[i].scheduledAt.getTime()).toBeGreaterThanOrEqual(
          seq.reminders[i - 1].scheduledAt.getTime(),
        );
      }
    });

    it('ordinal refleja posición original en offsets', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [0, -60, -1440], STANDARD_PROFILE);
      const ordinals = seq.reminders.map(r => r.ordinal);
      expect(ordinals).toEqual([2, 1, 0]);
    });
  });

  describe('intent', () => {
    it('assessment negativo → prepare_exam', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity({ date: '2026-07-15T10:00:00Z' }), 'assessment', [-60], STANDARD_PROFILE);
      expect(seq.reminders[0].intent).toBe('prepare_exam');
    });

    it('assessment con offset 0 → prepare_exam', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [0], STANDARD_PROFILE);
      expect(seq.reminders[0].intent).toBe('prepare_exam');
    });

    it('assessment positivo → follow_up', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [60], STANDARD_PROFILE);
      expect(seq.reminders[0].intent).toBe('follow_up');
    });

    it('schedule negativo → attend_class', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'schedule', [-30], STANDARD_PROFILE);
      expect(seq.reminders[0].intent).toBe('attend_class');
    });

    it('flashcard_deck negativo → review_cards', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'flashcard_deck', [-60], STANDARD_PROFILE);
      expect(seq.reminders[0].intent).toBe('review_cards');
    });

    it('grading_period negativo → submit_work', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'grading_period', [-1440], STANDARD_PROFILE);
      expect(seq.reminders[0].intent).toBe('submit_work');
    });
  });

  describe('priority', () => {
    it('assessment < 24h → critical', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const eventDate = new Date(ANCHOR.getTime() + 6 * 3600000);
      const seq = factory.buildSequence(
        makeEntity({ date: eventDate.toISOString() }),
        'assessment',
        [-60],
        STANDARD_PROFILE,
      );
      expect(seq.reminders[0].priority).toBe('critical');
    });

    it('assessment > 24h → high', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const eventDate = new Date(ANCHOR.getTime() + 72 * 3600000);
      const seq = factory.buildSequence(
        makeEntity({ date: eventDate.toISOString() }),
        'assessment',
        [-60],
        STANDARD_PROFILE,
      );
      expect(seq.reminders[0].priority).toBe('high');
    });

    it('assessment sin fecha → high', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [-60], STANDARD_PROFILE);
      expect(seq.reminders[0].priority).toBe('high');
    });

    it('schedule → normal', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'schedule', [-30], STANDARD_PROFILE);
      expect(seq.reminders[0].priority).toBe('normal');
    });

    it('flashcard_deck → normal', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'flashcard_deck', [0], STANDARD_PROFILE);
      expect(seq.reminders[0].priority).toBe('normal');
    });
  });

  describe('expiresAt', () => {
    it('usa el valor pasado como expiresAt', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const expDate = new Date('2026-07-15T11:00:00Z');
      const seq = factory.buildSequence(makeEntity(), 'assessment', [-60], STANDARD_PROFILE, expDate);
      expect(seq.expiresAt!.toISOString()).toBe('2026-07-15T11:00:00.000Z');
    });

    it('null explícito → null', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'generic', [-60], STANDARD_PROFILE, null);
      expect(seq.expiresAt).toBeNull();
    });

    it('undefined → null (default)', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'generic', [-60], STANDARD_PROFILE);
      expect(seq.expiresAt).toBeNull();
    });

    it('sin offsets con expiresAt → se usa el valor', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const expDate = new Date('2026-07-20T00:00:00Z');
      const seq = factory.buildSequence(makeEntity(), 'assessment', [], STANDARD_PROFILE, expDate);
      expect(seq.expiresAt!.toISOString()).toBe('2026-07-20T00:00:00.000Z');
    });
  });

  describe('regla C1 — secuencia vacía', () => {
    it('0 offsets → status = expired', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [], STANDARD_PROFILE);
      expect(seq.status).toBe('expired');
      expect(seq.reminders).toHaveLength(0);
    });

    it('offsets vacío tiene id y entityType correctos', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [], STANDARD_PROFILE);
      expect(seq.id).toBe('assessment::entity-1');
      expect(seq.entityType).toBe('assessment');
      expect(seq.entityId).toBe('entity-1');
      expect(seq.createdAt).toEqual(ANCHOR);
    });
  });

  describe('inmutabilidad', () => {
    it('Object.freeze aplicado al sequence', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [-60, 0], STANDARD_PROFILE);
      expect(Object.isFrozen(seq)).toBe(true);
    });

    it('reminders está congelado', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [-60, 0], STANDARD_PROFILE);
      expect(Object.isFrozen(seq.reminders)).toBe(true);
    });

    it('cada reminder está congelado', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [-60, 0], STANDARD_PROFILE);
      for (const r of seq.reminders) {
        expect(Object.isFrozen(r)).toBe(true);
      }
    });
  });

  describe('subjectId', () => {
    it('propaga subjectId de la entidad', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity({ subjectId: 's-42' }), 'assessment', [-60], STANDARD_PROFILE);
      expect(seq.reminders[0].subjectId).toBe('s-42');
    });

    it('subject_id snake case también funciona', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(
        makeEntity({ subjectId: undefined, subject_id: 's-99' }),
        'assessment',
        [-60],
        STANDARD_PROFILE,
      );
      expect(seq.reminders[0].subjectId).toBe('s-99');
    });

    it('subjectId es undefined si no existe en la entidad', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity({ subjectId: undefined }), 'assessment', [-60], STANDARD_PROFILE);
      expect(seq.reminders[0].subjectId).toBeUndefined();
    });
  });

  describe('profile en reminder', () => {
    it('cada reminder tiene el profile inyectado', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const customProfile: ReminderProfile = {
        name: 'persistent',
        defaultOffsets: [-60, 0, 60],
      };
      const seq = factory.buildSequence(makeEntity(), 'assessment', [-60, 0], customProfile);
      for (const r of seq.reminders) {
        expect(r.profile.name).toBe('persistent');
      }
    });
  });

  describe('createdAt', () => {
    it('createdAt = clock.now()', () => {
      const clock = new FakeClock(ANCHOR);
      const factory = new SequenceFactory(clock);
      const seq = factory.buildSequence(makeEntity(), 'assessment', [-60], STANDARD_PROFILE);
      expect(seq.createdAt.getTime()).toBe(ANCHOR.getTime());
    });
  });
});
