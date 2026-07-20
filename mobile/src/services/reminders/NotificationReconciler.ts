import type { NotificationProvider } from './NotificationProvider';
import type { DeliveryPlanResolved, DeliveryReminder } from './types';

export class NotificationReconciler {
  async sync(plan: DeliveryPlanResolved, provider: NotificationProvider): Promise<{ scheduled: number; cancelled: number }> {
    const planIds = new Set(plan.deliverables.map((d) => d.id));
    const existing = await provider.getAll();

    const planMap = new Map(plan.deliverables.map((d) => [d.id, d]));
    const existingMap = new Map(existing.map((e) => [e.identifier, e]));

    const toCancel = existing.filter((e) => {
      const d = planMap.get(e.identifier);
      if (!d) return true;
      const timeDiff = d.scheduledAt.getTime() - (e.triggerDate?.getTime() ?? 0);
      return Math.abs(timeDiff) > 1000 || d.title !== e.title || d.body !== e.body;
    });

    const toSchedule = plan.deliverables.filter((d) => {
      const e = existingMap.get(d.id);
      if (!e) return true;
      const timeDiff = d.scheduledAt.getTime() - (e.triggerDate?.getTime() ?? 0);
      return Math.abs(timeDiff) > 1000 || d.title !== e.title || d.body !== e.body;
    });

    const cancelPromises = toCancel.map((e) => provider.cancel(e.identifier));
    const schedulePromises = toSchedule.map((d) =>
      provider.schedule({
        id: d.id,
        title: d.title,
        body: d.body,
        scheduledAt: d.scheduledAt,
        priority: d.priority,
        badge: d.badge,
        deeplink: d.deeplink,
      }),
    );

    await Promise.all([...cancelPromises, ...schedulePromises]);

    return { scheduled: toSchedule.length, cancelled: toCancel.length };
  }

  async clear(provider: NotificationProvider): Promise<void> {
    const existing = await provider.getAll();
    const ids = [...new Set(existing.map((e) => e.identifier))];
    if (ids.length > 0) {
      await Promise.all(ids.map((id) => provider.cancel(id)));
    }
  }
}
