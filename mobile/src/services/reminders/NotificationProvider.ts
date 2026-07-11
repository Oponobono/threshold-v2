import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ScheduledReminder } from './types';

export interface ScheduledNotificationInfo {
  readonly identifier: string;
  readonly title: string;
  readonly body: string;
  readonly triggerDate: Date | null;
}

export interface NotificationProvider {
  requestPermissions(): Promise<boolean>;
  setupChannels(): Promise<void>;
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

  async schedule(reminder: ScheduledReminder): Promise<string> {
    const triggerDate = reminder.scheduledAt.getTime();
    const now = Date.now();
    const seconds = Math.max(1, Math.floor((triggerDate - now) / 1000));

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
      trigger: {
        type: ExpoNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: 'reminders',
      },
    });

    return identifier;
  }

  async cancel(id: string): Promise<void> {
    await ExpoNotifications.cancelScheduledNotificationAsync(id);
  }

  async cancelAll(prefix?: string): Promise<void> {
    if (prefix) {
      const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
      const toCancel = scheduled
        .filter((n) => n.identifier.startsWith(prefix))
        .map((n) => n.identifier);

      await Promise.all(toCancel.map((id) => ExpoNotifications.cancelScheduledNotificationAsync(id)));
    } else {
      await ExpoNotifications.cancelAllScheduledNotificationsAsync();
    }
  }

  async getAll(): Promise<ScheduledNotificationInfo[]> {
    const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
    return scheduled.map((n) => ({
      identifier: n.identifier,
      title: n.content.title ?? '',
      body: n.content.body ?? '',
      triggerDate: n.trigger
        ? 'value' in n.trigger && n.trigger.value instanceof Date
          ? n.trigger.value
          : 'seconds' in n.trigger
            ? new Date(Date.now() + (n.trigger.seconds as number) * 1000)
            : null
        : null,
    }));
  }
}
