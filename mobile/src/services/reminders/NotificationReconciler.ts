import type { NotificationProvider } from './NotificationProvider';
import type { DeliveryPlanResolved, DeliveryReminder } from './types';

export class NotificationReconciler {
  async sync(plan: DeliveryPlanResolved, provider: NotificationProvider): Promise<{ scheduled: number; cancelled: number }> {
    const planIds = new Set(plan.deliverables.map((d) => d.id));
    const existing = await provider.getAll();

    const toCancel = existing.filter((e) => !planIds.has(e.identifier));
    const toSchedule = plan.deliverables.filter(
      (d) => !existing.some((e) => e.identifier === d.id),
    );

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
