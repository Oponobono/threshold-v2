import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ScheduledReminder } from './types';

export interface ScheduledNotificationInfo {
  readonly identifier: string;
  readonly title: string;
  readonly body: string;
  readonly triggerDate: Date | null;
}

export interface NotificationHandler {
  handleNotification: () => Promise<{
    shouldShowAlert: boolean;
    shouldPlaySound: boolean;
    shouldSetBadge: boolean;
    shouldShowBanner: boolean;
    shouldShowList: boolean;
  }>;
}

export interface NotificationProvider {
  requestPermissions(): Promise<boolean>;
  setupChannels(): Promise<void>;
  setForegroundHandler(handler: NotificationHandler): void;
  schedule(reminder: ScheduledReminder): Promise<string>;
  cancel(id: string): Promise<void>;
  cancelAll(prefix?: string): Promise<void>;
  getAll(): Promise<ScheduledNotificationInfo[]>;
}

export class ExpoNotificationProvider implements NotificationProvider {
  async requestPermissions(): Promise<boolean> {
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async setupChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      await ExpoNotifications.setNotificationChannelAsync('reminders', {
        name: 'Recordatorios',
        importance: ExpoNotifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 100, 100],
        sound: 'default',
      });

      await ExpoNotifications.setNotificationChannelAsync('progress', {
        name: 'Progreso',
        importance: ExpoNotifications.AndroidImportance.LOW,
        sound: null,
        vibrationPattern: undefined,
      });
    }
  }

  setForegroundHandler(handler: NotificationHandler): void {
    ExpoNotifications.setNotificationHandler(handler);
  }

  async schedule(reminder: ScheduledReminder): Promise<string> {
    const now = Date.now();
    const triggerTime = reminder.scheduledAt.getTime();
    const secondsUntil = Math.floor((triggerTime - now) / 1000);

    if (secondsUntil < -60) {
      console.log(`[SCHEDULE] SKIP ${reminder.id} | scheduledAt is in the past by ${Math.abs(secondsUntil)}s`);
      return reminder.id;
    }

    const trigger = {
      type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
      date: reminder.scheduledAt,
      channelId: 'reminders',
    };

    console.log(`[SCHEDULE] ${reminder.id} | DATE trigger | scheduledAt=${reminder.scheduledAt.toISOString()} | now=${new Date(now).toISOString()} | delta=${secondsUntil}s`);

    const identifier = await ExpoNotifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: {
          reminderId: reminder.id,
          deeplink: reminder.deeplink,
          priority: reminder.priority,
        },
        sound: true,
        ...(Platform.OS === 'android'
          ? {
              priority: reminder.priority === 'critical'
                ? ExpoNotifications.AndroidNotificationPriority.MAX
                : reminder.priority === 'high'
                  ? ExpoNotifications.AndroidNotificationPriority.HIGH
                  : ExpoNotifications.AndroidNotificationPriority.DEFAULT,
              channelId: 'reminders',
            }
          : {}),
        ...(reminder.badge !== undefined ? { badge: reminder.badge } : {}),
      },
      trigger,
    });

    const all = await ExpoNotifications.getAllScheduledNotificationsAsync();
    console.log(`[SCHEDULE] result=${identifier} | total_scheduled=${all.length}`);

    return identifier;
  }

  async cancel(id: string): Promise<void> {
    console.log(`[CANCEL] ${id}`);
    await ExpoNotifications.cancelScheduledNotificationAsync(id);
  }

  async cancelAll(prefix?: string): Promise<void> {
    if (prefix) {
      const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
      const toCancel = scheduled
        .filter((n: any) => n.identifier.startsWith(prefix))
        .map((n: any) => n.identifier);

      await Promise.all(toCancel.map((id) => ExpoNotifications.cancelScheduledNotificationAsync(id)));
    } else {
      await ExpoNotifications.cancelAllScheduledNotificationsAsync();
    }
  }

  async getAll(): Promise<ScheduledNotificationInfo[]> {
    const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
    return scheduled.map((n: any) => ({
      identifier: n.identifier,
      title: n.content.title ?? '',
      body: n.content.body ?? '',
      triggerDate: n.trigger
        ? 'date' in n.trigger
          ? n.trigger.date instanceof Date ? n.trigger.date : new Date(n.trigger.date as number)
          : 'value' in n.trigger
            ? n.trigger.value instanceof Date ? n.trigger.value : new Date(n.trigger.value as number)
            : 'seconds' in n.trigger
              ? new Date(Date.now() + (n.trigger.seconds as number) * 1000)
              : null
        : null,
    }));
  }
}
