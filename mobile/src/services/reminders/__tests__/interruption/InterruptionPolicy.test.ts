import { InterruptionPolicy } from '../../InterruptionPolicy';
import { FakeClock } from '../../Clock';
import { ReminderSnapshot } from '../../types';
import type { ReminderSequence, Reminder, InterruptionPriority, ReminderProfile } from '../../types';

const ANCHOR = new Date('2026-07-10T12:00:00Z');

const STANDARD_PROFILE: ReminderProfile = { name: 'standard', defaultOffsets: [0] };

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    entityType: 'assessment',
    entityId: 'a1',
    scheduledAt: new Date(ANCHOR.getTime() + 3600000),
    intent: 'prepare_exam',
    profile: STANDARD_PROFILE,
    priority: 'high',
    sequenceId: 's1',
    ordinal: 0,
    status: 'pending',
    snapshot: new ReminderSnapshot({ entity: { id: 'a1', type: 'assessment', name: '' } }),
    ...overrides,
  };
}

function sequence(reminders: Reminder[], overrides: Partial<ReminderSequence> = {}): ReminderSequence {
  return {
    id: 's1',
    entityType: 'assessment',
    entityId: 'a1',
    reminders,
    createdAt: ANCHOR,
    expiresAt: null,
    status: 'active',
    ...overrides,
  };
}

function timestampsEqual(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

describe('InterruptionPolicy', () => {
  let policy: InterruptionPolicy;
  let clock: FakeClock;

  beforeEach(() => {
    clock = new FakeClock(ANCHOR);
    policy = new InterruptionPolicy(clock);
  });

  describe('collect', () => {
    it('includes pending future reminders', () => {
      const r = reminder({ status: 'pending', scheduledAt: new Date(ANCHOR.getTime() + 3600000) });
      const plan = policy.resolve([sequence([r])]);
      expect(plan.deliverables).toHaveLength(1);
    });

    it('filters out expired sequences', () => {
      const r = reminder({ status: 'pending' });
      const seq = sequence([r], { status: 'expired' });
      const plan = policy.resolve([seq]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('filters out cancelled sequences', () => {
      const r = reminder({ status: 'pending' });
      const seq = sequence([r], { status: 'cancelled' });
      const plan = policy.resolve([seq]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('filters out completed sequences', () => {
      const r = reminder({ status: 'pending' });
      const seq = sequence([r], { status: 'completed' });
      const plan = policy.resolve([seq]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('filters out expiredAt before now', () => {
      const r = reminder({ status: 'pending' });
      const seq = sequence([r], { expiresAt: new Date(ANCHOR.getTime() - 60000) });
      const plan = policy.resolve([seq]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('filters past reminders', () => {
      const r = reminder({ status: 'pending', scheduledAt: new Date(ANCHOR.getTime() - 3600000) });
      const plan = policy.resolve([sequence([r])]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('filters superseded reminders', () => {
      const r = reminder({ status: 'superseded' });
      const plan = policy.resolve([sequence([r])]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('filters delivered reminders', () => {
      const r = reminder({ status: 'delivered' });
      const plan = policy.resolve([sequence([r])]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('suppressReview removes review_cards intent', () => {
      const r = reminder({ intent: 'review_cards', status: 'pending' });
      const plan = policy.resolve([sequence([r])], true);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('setActiveStudy suppresses review', () => {
      policy.setActiveStudy(true);
      const r = reminder({ intent: 'review_cards', status: 'pending' });
      const plan = policy.resolve([sequence([r])]);
      expect(plan.deliverables).toHaveLength(0);
    });

    it('setActiveStudy false includes review', () => {
      policy.setActiveStudy(false);
      const r = reminder({ intent: 'review_cards', status: 'pending' });
      const plan = policy.resolve([sequence([r])]);
      expect(plan.deliverables).toHaveLength(1);
    });

    it('suppressReview parameter takes precedence over instance state', () => {
      policy.setActiveStudy(true);
      const r = reminder({ intent: 'review_cards', status: 'pending' });
      const plan = policy.resolve([sequence([r])], false);
      expect(plan.deliverables).toHaveLength(1);
    });
  });

  describe('collisions', () => {
    it('two reminders same minute: higher priority wins, lower shifted +5 min', () => {
      const t = ANCHOR.getTime() + 3600000;
      const lowR = reminder({ id: 'low', priority: 'low', scheduledAt: new Date(t) });
      const highR = reminder({ id: 'high', priority: 'high', scheduledAt: new Date(t) });
      const plan = policy.resolve([sequence([lowR, highR])]);

      expect(plan.deliverables).toHaveLength(2);
      expect(plan.deliverables[0].priority).toBe('high');
      expect(plan.deliverables[1].priority).toBe('low');
      expect(plan.deliverables[1].scheduledAt.getTime()).toBe(t + 5 * 60 * 1000);
    });

    it('critical beats high, normal, low', () => {
      const t = ANCHOR.getTime() + 3600000;
      const r1 = reminder({ id: 'r1', priority: 'normal', scheduledAt: new Date(t) });
      const r2 = reminder({ id: 'r2', priority: 'critical', scheduledAt: new Date(t) });
      const r3 = reminder({ id: 'r3', priority: 'low', scheduledAt: new Date(t) });
      const r4 = reminder({ id: 'r4', priority: 'high', scheduledAt: new Date(t) });
      const plan = policy.resolve([sequence([r1, r2, r3, r4])]);

      expect(plan.deliverables[0].priority).toBe('critical');
      expect(plan.deliverables).toHaveLength(3);
    })

    it('same priority: first in sort order stays, second shifts', () => {
      const t = ANCHOR.getTime() + 3600000;
      const r1 = reminder({ id: 'r1', priority: 'high', scheduledAt: new Date(t) });
      const r2 = reminder({ id: 'r2', priority: 'high', scheduledAt: new Date(t) });
      const plan = policy.resolve([sequence([r1, r2])]);

      expect(plan.deliverables[0].id).toBe('r1');
      expect(plan.deliverables[1].scheduledAt.getTime()).toBe(t + 5 * 60 * 1000);
    });

    it('reminders in different minutes not shifted', () => {
      const t = ANCHOR.getTime() + 3600000;
      const r1 = reminder({ id: 'r1', priority: 'low', scheduledAt: new Date(t) });
      const r2 = reminder({ id: 'r2', priority: 'high', scheduledAt: new Date(t + 10 * 60 * 1000) });
      const plan = policy.resolve([sequence([r1, r2])]);

      expect(timestampsEqual(plan.deliverables[0].scheduledAt, r1.scheduledAt)).toBe(true);
      expect(timestampsEqual(plan.deliverables[1].scheduledAt, r2.scheduledAt)).toBe(true);
    });
  });

  describe('simultaneous limit', () => {
    it('more than 3 reminders: only 3 in deliverables', () => {
      const r = (id: string, priority: InterruptionPriority, minutes: number) =>
        reminder({ id, priority, scheduledAt: new Date(ANCHOR.getTime() + minutes * 60000) });
      const rs = [
        r('r1', 'high', 60),
        r('r2', 'low', 60),
        r('r3', 'normal', 60),
        r('r4', 'critical', 60),
      ];

      const plan = policy.resolve([sequence(rs)]);

      expect(plan.deliverables.length).toBeLessThanOrEqual(3);
    })

    it('reminders across multiple groups all retained up to limit', () => {
      const r = (id: string, priority: InterruptionPriority, minutes: number) =>
        reminder({ id, priority, scheduledAt: new Date(ANCHOR.getTime() + minutes * 60000) });
      const r1 = r('r1', 'high', 60);
      const r2 = r('r2', 'low', 120);
      const r3 = r('r3', 'normal', 180);
      const plan = policy.resolve([sequence([r1, r2, r3])]);
      expect(plan.deliverables).toHaveLength(3);
    })
  });

  describe('grouping', () => {
    it('reminders within 5 minute window are collapsed', () => {
      const t = ANCHOR.getTime() + 3600000;
      const r1 = reminder({ id: 'r1', priority: 'high', scheduledAt: new Date(t) });
      const r2 = reminder({ id: 'r2', priority: 'low', scheduledAt: new Date(t + 3 * 60 * 1000) });
      const r3 = reminder({ id: 'r3', priority: 'normal', scheduledAt: new Date(t + 6 * 60 * 1000) });
      const plan = policy.resolve([sequence([r1, r2, r3])]);

      expect(plan.deliverables).toHaveLength(3);
      expect(plan.deliverables[0].priority).toBe('high');
      expect(plan.deliverables[1].priority).toBe('low');
      expect(timestampsEqual(plan.deliverables[1].scheduledAt, new Date(t + 5 * 60 * 1000))).toBe(true);
    });
  });

  describe('delivery plan metadata', () => {
    it('has planId, version, generatedAt', () => {
      const r = reminder({ status: 'pending' });
      const plan = policy.resolve([sequence([r])]);

      expect(plan.planId).toBeDefined();
      expect(plan.version).toBe(1);
      expect(plan.generatedAt).toEqual(ANCHOR);
    });

    it('version increments across resolve calls', () => {
      const r = reminder({ status: 'pending' });
      policy.resolve([sequence([r])]);
      const plan2 = policy.resolve([sequence([r])]);
      expect(plan2.version).toBe(2);

      const plan3 = policy.resolve([sequence([r])]);
      expect(plan3.version).toBe(3);
    });

    it('planId contains version number', () => {
      policy.resetCounter();
      const r = reminder({ status: 'pending' });
      const plan = policy.resolve([sequence([r])]);
      expect(plan.planId).toContain('plan-');
      expect(plan.planId).toContain('-1');
    });
  });

  describe('stability', () => {
    it('same input produces same number of deliverables', () => {
      const r = (id: string, priority: InterruptionPriority) =>
        reminder({ id, priority, scheduledAt: new Date(ANCHOR.getTime() + 3600000) });
      const rs = [r('r1', 'high'), r('r2', 'normal')];
      const seq = sequence(rs);

      const plan1 = policy.resolve([seq]);
      policy.resetCounter();
      const plan2 = policy.resolve([seq]);

      expect(plan1.deliverables).toHaveLength(plan2.deliverables.length);
      expect(plan1.deliverables.map(d => d.id)).toEqual(plan2.deliverables.map(d => d.id));
    });

    it('empty sequences produce empty plan', () => {
      const plan = policy.resolve([]);
      expect(plan.deliverables).toHaveLength(0);
      expect(plan.version).toBe(1);
    });
  });

  describe('domain contract', () => {
    it('deliverables are DeliveryReminderDomain (no title/body/badge)', () => {
      const r = reminder({ status: 'pending' });
      const plan = policy.resolve([sequence([r])]);
      const d = plan.deliverables[0];
      expect(d.id).toBeDefined();
      expect(d.scheduledAt).toBeDefined();
      expect(d.entityType).toBeDefined();
      expect(d.entityId).toBeDefined();
      expect(d.intent).toBeDefined();
      expect(d.priority).toBeDefined();
      expect((d as any).title).toBeUndefined();
      expect((d as any).body).toBeUndefined();
      expect((d as any).badge).toBeUndefined();
    });
  });
});
