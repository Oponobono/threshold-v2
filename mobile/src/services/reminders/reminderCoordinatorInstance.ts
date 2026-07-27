import { createDefaultReminderCoordinator } from './ReminderSystemFactory';
import type { ReminderCoordinator } from './ReminderCoordinator';
import i18n from '../../locales/i18n';

let _instance: ReminderCoordinator | null = null;

export async function getReminderCoordinator(): Promise<ReminderCoordinator> {
  if (!_instance) {
    _instance = await createDefaultReminderCoordinator(undefined, {
      i18n: {
        translate(key: string, params?: Record<string, any>): string {
          const i18nKey = `reminders.${key}`;
          const translated = i18n.t(i18nKey, params);
          return translated !== i18nKey ? translated : (params?.default ?? key);
        }
      }
    });
  }
  return _instance;
}

export function resetReminderCoordinator(): void {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}
