import { NotificationReconciler } from '../NotificationReconciler';
import { ReminderSnapshot } from '../types';
import type { NotificationProvider, ScheduledNotificationInfo } from '../NotificationProvider';
import type { DeliveryPlanResolved, DeliveryReminder } from '../types';

class MockProvider implements NotificationProvider {
  public existing: ScheduledNotificationInfo[] = [];
  public scheduleCalls: any[] = [];
  public cancelCalls: string[] = [];

  async requestPermissions(): Promise<boolean> { return true; }
  async setupChannels(): Promise<void> {}
  async schedule(reminder: any): Promise<string> {
    this.scheduleCalls.push({ id: reminder.id, title: reminder.title, body: reminder.body });
    return reminder.id;
  }
  async cancel(id: string): Promise<void> {
    this.cancelCalls.push(id);
  }
  async cancelAll(prefix?: string): Promise<void> {
    this.cancelCalls.push('ALL');
  }
  async getAll(): Promise<ScheduledNotificationInfo[]> {
    return this.existing;
  }
}

function makePlan(deliverables: DeliveryReminder[]): DeliveryPlanResolved {
  return {
    planId: 'plan-1',
    version: 1,
    generatedAt: new Date(),
    deliverables,
  };
}

function makeReminder(id: string, overrides?: Partial<DeliveryReminder>): DeliveryReminder {
  return {
    id,
    title: 'Title ' + id,
    body: 'Body ' + id,
    scheduledAt: new Date(Date.now() + 86400000),
    entityType: 'assessment',
    entityId: 'a-1',
    subjectId: undefined,
    intent: 'prepare_exam',
    priority: 'high',
    deeplink: 'assessments/a-1',
    snapshot: new ReminderSnapshot({ entity: { id: 'a-1', type: 'assessment', name: '' } }),
    ...overrides,
  };
}

describe('NotificationReconciler', () => {
  let reconciler: NotificationReconciler;
  let provider: MockProvider;

  beforeEach(() => {
    reconciler = new NotificationReconciler();
    provider = new MockProvider();
  });

  it('schedules new reminders not in provider', async () => {
    provider.existing = [{ identifier: 'existing-1', title: 'Existing', body: '', triggerDate: new Date() }];
    const plan = makePlan([makeReminder('new-1'), makeReminder('new-2')]);
    await reconciler.sync(plan, provider);
    expect(provider.scheduleCalls.length).toBe(2);
    expect(provider.cancelCalls.length).toBe(1);
    expect(provider.cancelCalls[0]).toBe('existing-1');
  });

  it('cancels reminders in provider but not in plan', async () => {
    provider.existing = [
      { identifier: 'r1', title: 'R1', body: '', triggerDate: new Date() },
      { identifier: 'r2', title: 'R2', body: '', triggerDate: new Date() },
    ];
    const plan = makePlan([makeReminder('r1')]);
    await reconciler.sync(plan, provider);
    expect(provider.cancelCalls).toEqual(['r2']);
    expect(provider.scheduleCalls.length).toBe(0);
  });

  it('does nothing when plan matches provider exactly', async () => {
    provider.existing = [{ identifier: 'r1', title: 'Title r1', body: 'Body r1', triggerDate: new Date(Date.now() + 86400000) }];
    const plan = makePlan([makeReminder('r1')]);
    await reconciler.sync(plan, provider);
    expect(provider.scheduleCalls.length).toBe(0);
    expect(provider.cancelCalls.length).toBe(0);
  });

  it('handles empty plan by cancelling everything', async () => {
    provider.existing = [
      { identifier: 'r1', title: 'R1', body: '', triggerDate: new Date() },
      { identifier: 'r2', title: 'R2', body: '', triggerDate: new Date() },
    ];
    const plan = makePlan([]);
    await reconciler.sync(plan, provider);
    expect(provider.cancelCalls).toContain('r1');
    expect(provider.cancelCalls).toContain('r2');
    expect(provider.scheduleCalls.length).toBe(0);
  });

  it('handles empty provider by scheduling all', async () => {
    const plan = makePlan([makeReminder('r1'), makeReminder('r2')]);
    await reconciler.sync(plan, provider);
    expect(provider.scheduleCalls.length).toBe(2);
    expect(provider.cancelCalls.length).toBe(0);
  });

  it('clear cancels all existing notifications', async () => {
    provider.existing = [
      { identifier: 'r1', title: 'R1', body: '', triggerDate: new Date() },
      { identifier: 'r2', title: 'R2', body: '', triggerDate: new Date() },
    ];
    await reconciler.clear(provider);
    expect(provider.cancelCalls).toContain('r1');
    expect(provider.cancelCalls).toContain('r2');
    expect(provider.cancelCalls.length).toBe(2);
  });
});
