import type { I18nService } from './I18nService';
import type { DeliveryPlan, DeliveryPlanResolved, DeliveryReminder, DeliveryReminderDomain } from './types';

export class TemplateResolver {
  constructor(private i18n: I18nService) {}

  enrich(plan: DeliveryPlan): DeliveryPlanResolved {
    const deliverables = plan.deliverables.map((d): DeliveryReminder => ({
      ...d,
      title: this._resolveTitle(d),
      body: this._resolveBody(d),
      deeplink: this._resolveDeeplink(d),
      badge: d.priority === 'critical' ? 1 : undefined,
    }));

    return {
      planId: plan.planId,
      version: plan.version,
      generatedAt: plan.generatedAt,
      deliverables,
    };
  }

  private _resolveEntityName(reminder: DeliveryReminderDomain): string {
    if (reminder.entityType === 'schedule' && reminder.snapshot.subject?.name) {
      return reminder.snapshot.subject.name;
    }
    if (reminder.snapshot.entity.name) return reminder.snapshot.entity.name;
    return this.i18n.translate('category.' + reminder.entityType, { default: reminder.entityType });
  }

  private _resolveTitle(reminder: DeliveryReminderDomain): string {
    return this.i18n.translate('intentTitle.' + reminder.intent, { entity: this._resolveEntityName(reminder) });
  }

  private _resolveBody(reminder: DeliveryReminderDomain): string {
    return this.i18n.translate('intentBody.' + reminder.intent, { entity: this._resolveEntityName(reminder) });
  }

  private _resolveDeeplink(reminder: DeliveryReminderDomain): string | undefined {
    if (reminder.entityType === 'assessment') return 'threshold://assessments/' + reminder.entityId;
    if (reminder.entityType === 'schedule') return 'threshold://schedules/' + reminder.entityId;
    if (reminder.entityType === 'flashcard_deck') return 'threshold://decks/' + reminder.entityId;
    if (reminder.entityType === 'grading_period') return 'threshold://grades/' + reminder.entityId;
    if (reminder.entityType === 'calendar_event') return 'threshold://events/' + reminder.entityId;
    return undefined;
  }
}
