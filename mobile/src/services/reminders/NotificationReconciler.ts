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
      if (!d) {
        console.log(`[RECON] CANCEL ${e.identifier} | reason: not in plan`);
        return true;
      }
      const timeDiff = d.scheduledAt.getTime() - (e.triggerDate?.getTime() ?? 0);
      const changed = Math.abs(timeDiff) > 1000 || d.title !== e.title || d.body !== e.body;
      if (changed) {
        console.log(`[RECON] CANCEL ${e.identifier} | reason: delta=${timeDiff}ms title_changed=${d.title !== e.title} body_changed=${d.body !== e.body} | plan=${d.scheduledAt.toISOString()} existing=${e.triggerDate?.toISOString()}`);
      }
      return changed;
    });

    const toSchedule = plan.deliverables.filter((d) => {
      const e = existingMap.get(d.id);
      if (!e) {
        console.log(`[RECON] SCHEDULE ${d.id} | reason: not yet scheduled | scheduledAt=${d.scheduledAt.toISOString()}`);
        return true;
      }
      const timeDiff = d.scheduledAt.getTime() - (e.triggerDate?.getTime() ?? 0);
      const changed = Math.abs(timeDiff) > 1000 || d.title !== e.title || d.body !== e.body;
      if (changed) {
        console.log(`[RECON] SCHEDULE ${d.id} | reason: delta=${timeDiff}ms | plan=${d.scheduledAt.toISOString()} existing=${e.triggerDate?.toISOString()}`);
      }
      return changed;
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

    console.log(`[RECON] sync done: scheduled=${toSchedule.length} cancelled=${toCancel.length} existing=${existing.length} plan=${plan.deliverables.length}`);

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
