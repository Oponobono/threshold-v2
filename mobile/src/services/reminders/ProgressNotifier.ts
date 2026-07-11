import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface ProgressNotifier {
  show(id: string, title: string, body: string, progress: number): Promise<void>;
  update(id: string, progress: number, body: string): Promise<void>;
  complete(id: string, title: string, body: string): Promise<void>;
  cancel(id: string): Promise<void>;
}

export class ExpoProgressNotifier implements ProgressNotifier {
  async show(id: string, title: string, body: string, progress: number): Promise<void> {
    await this._schedule(id, title, `${body}: ${progress}%`);
  }

  async update(id: string, progress: number, body: string): Promise<void> {
    await this._schedule(id, undefined, `${body}: ${progress}%`);
  }

  async complete(id: string, title: string, body: string): Promise<void> {
    await this._schedule(id, `✅ ${title}`, body);
  }

  async cancel(id: string): Promise<void> {
    await ExpoNotifications.cancelScheduledNotificationAsync(id);
  }

  private async _schedule(id: string, title?: string, body?: string): Promise<void> {
    await ExpoNotifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: title ?? '',
        body: body ?? '',
        data: { type: 'progress', progressId: id },
        sound: true,
        ...(Platform.OS === 'android'
          ? { priority: ExpoNotifications.AndroidNotificationPriority.DEFAULT, channelId: 'progress' }
          : {}),
      },
      trigger: {
        seconds: 1,
        channelId: 'progress',
        type: ExpoNotifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
  }
}
