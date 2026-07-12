import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../locales/i18n';

// ── Types ───────────────────────────────────────────────────────────────────────

export interface WeeklyDigestConfig {
  dayOfWeek: number; // 0=Sunday, 1=Monday, ... 6=Saturday
  hour: number;
  minute: number;
}

interface ScheduledInfo {
  identifier: string;
  title: string;
  body: string;
  triggerDate?: Date;
}

const DEADLINE_PREFIX = 'deadline_';
const WEEKLY_ID = 'weekly_digest';
const CLASS_PREFIX = 'class_';

function toExpoWeekday(apiDayOfWeek: number): number {
  // API: 1=Monday..7=Sunday → Expo: 1=Sunday..7=Saturday
  return apiDayOfWeek === 7 ? 1 : apiDayOfWeek + 1;
}

// ── Download progress notifications ──────────────────────────────────────────────

const DOWNLOAD_NOTIF_ID = 'model_download';

export async function showDownloadProgressNotification(title: string, progress: number): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: DOWNLOAD_NOTIF_ID,
    content: {
      title: `⬇️ ${title}`,
      body: `${progress}%`,
      data: { type: 'download_progress' },
      sound: true,
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.DEFAULT } : {}),
    },
    trigger: { seconds: 1, channelId: 'default', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function updateDownloadProgressNotification(title: string, progress: number): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: DOWNLOAD_NOTIF_ID,
    content: {
      title: `⬇️ ${title}`,
      body: `${progress}%`,
      data: { type: 'download_progress' },
      sound: true,
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.DEFAULT } : {}),
    },
    trigger: { seconds: 1, channelId: 'default', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function completeDownloadNotification(title: string): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: DOWNLOAD_NOTIF_ID,
    content: {
      title: `✅ ${title}`,
      body: 'Descarga completada',
      data: { type: 'download_complete' },
      sound: true,
    },
    trigger: { seconds: 1, channelId: 'default', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function cancelDownloadNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DOWNLOAD_NOTIF_ID);
}

// ── Backup upload progress notifications ─────────────────────────────────────────

const BACKUP_UPLOAD_ID = 'backup_upload';

export async function showBackupUploadNotification(total: number): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: BACKUP_UPLOAD_ID,
    content: {
      title: `⬆️ ${i18n.t('backup.backingUp')}`,
      body: `0 / ${total}`,
      data: { type: 'backup_upload_progress' },
      sound: true,
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.DEFAULT } : {}),
    },
    trigger: { seconds: 1, channelId: 'backup-progress', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function updateBackupUploadNotification(done: number, total: number, currentItem: string): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: BACKUP_UPLOAD_ID,
    content: {
      title: `⬆️ ${i18n.t('backup.backingUp')}`,
      body: `${done} / ${total} · ${currentItem}`,
      data: { type: 'backup_upload_progress' },
      sound: true,
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.DEFAULT } : {}),
    },
    trigger: { seconds: 1, channelId: 'backup-progress', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function completeBackupUploadNotification(title: string, body: string): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: BACKUP_UPLOAD_ID,
    content: { title, body, data: { type: 'backup_upload_complete' }, sound: true },
    trigger: { seconds: 1, channelId: 'backup-progress', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function cancelBackupUploadNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BACKUP_UPLOAD_ID);
}

// ── Backup download progress notifications ───────────────────────────────────────

const BACKUP_DOWNLOAD_ID = 'backup_download';

export async function showBackupDownloadNotification(total: number): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: BACKUP_DOWNLOAD_ID,
    content: {
      title: `⬇️ ${i18n.t('backup.downloading')}`,
      body: `0 / ${total}`,
      data: { type: 'backup_download_progress' },
      sound: true,
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.DEFAULT } : {}),
    },
    trigger: { seconds: 1, channelId: 'backup-progress', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function updateBackupDownloadNotification(done: number, total: number, currentItem: string): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: BACKUP_DOWNLOAD_ID,
    content: {
      title: `⬇️ ${i18n.t('backup.downloading')}`,
      body: `${done} / ${total} · ${currentItem}`,
      data: { type: 'backup_download_progress' },
      sound: true,
      ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.DEFAULT } : {}),
    },
    trigger: { seconds: 1, channelId: 'backup-progress', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function completeBackupDownloadNotification(title: string, body: string): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: BACKUP_DOWNLOAD_ID,
    content: { title, body, data: { type: 'backup_download_complete' }, sound: true },
    trigger: { seconds: 1, channelId: 'backup-progress', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
}

export async function cancelBackupDownloadNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(BACKUP_DOWNLOAD_ID);
}

// ── Init ────────────────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: i18n.t('notifications.channelName'),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
    });
  }
  return true;
}

// ── Identifier helpers ──────────────────────────────────────────────────────────

function deadlineId(eventId: string): string {
  return `${DEADLINE_PREFIX}${eventId}`;
}

// ── Deadline notifications ──────────────────────────────────────────────────────

export async function scheduleDeadlineNotification(
  eventId: string,
  title: string,
  eventTime: Date,
  leadMinutes: number = 15,
): Promise<string | undefined> {
  const granted = await requestPermissions();
  if (!granted) return undefined;

  const triggerDate = new Date(eventTime.getTime() - leadMinutes * 60_000);
  if (triggerDate <= new Date()) return undefined;

  const id = await Notifications.scheduleNotificationAsync({
    identifier: deadlineId(eventId),
    content: {
      title: i18n.t('notifications.deadlineAlertTitle'),
      body: i18n.t('notifications.deadlineAlertBody', { title, minutes: leadMinutes }),
      data: { eventId, type: 'deadline' },
      sound: true,
    },
    trigger: { date: triggerDate, channelId: 'default' },
  });
  return id;
}

export async function cancelDeadlineNotification(eventId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(deadlineId(eventId));
}

export async function cancelAllDeadlineNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(DEADLINE_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ── Class schedule notifications ────────────────────────────────────

export async function scheduleClassNotification(
  scheduleId: number,
  subjectName: string,
  dayOfWeek: number,
  startTime: string,
  leadMinutes: number = 5,
): Promise<string | undefined> {
  const granted = await requestPermissions();
  if (!granted) return undefined;

  const [hour, minute] = startTime.split(':').map(Number);
  let triggerHour = hour;
  let triggerMinute = minute - leadMinutes;
  if (triggerMinute < 0) {
    triggerHour -= 1;
    triggerMinute += 60;
  }
  if (triggerHour < 0) return undefined;

  const id = await Notifications.scheduleNotificationAsync({
    identifier: `${CLASS_PREFIX}${scheduleId}`,
    content: {
      title: i18n.t('notifications.classAlertTitle'),
      body: i18n.t('notifications.classAlertBody', { name: subjectName, minutes: leadMinutes }),
      data: { scheduleId, type: 'class' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: toExpoWeekday(dayOfWeek),
      hour: triggerHour,
      minute: triggerMinute,
    },
  });
  return id;
}

export async function cancelClassNotification(scheduleId: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(`${CLASS_PREFIX}${scheduleId}`);
}

export async function cancelAllClassNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(CLASS_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ── Weekly digest ───────────────────────────────────────────────────────────────

export async function scheduleWeeklyDigest(
  config: WeeklyDigestConfig,
): Promise<string | undefined> {
  const granted = await requestPermissions();
  if (!granted) return undefined;

  // expo weekday: 1=Sunday, 2=Monday, ...
  const expoWeekday = config.dayOfWeek + 1;

  const id = await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_ID,
    content: {
      title: i18n.t('notifications.weeklyDigestTitle'),
      body: i18n.t('notifications.weeklyDigestBody'),
      data: { type: 'weekly_digest', dayOfWeek: config.dayOfWeek, hour: config.hour, minute: config.minute },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: expoWeekday,
      hour: config.hour,
      minute: config.minute,
    },
  });
  return id;
}

export async function cancelWeeklyDigest(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_ID);
}

// ── Get all scheduled ───────────────────────────────────────────────────────────

export async function getScheduledNotifications(): Promise<ScheduledInfo[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map(n => ({
    identifier: n.identifier,
    title: n.content.title || '',
    body: n.content.body || '',
    triggerDate: (n.trigger as any)?.dateComponents
      ? undefined
      : (n.trigger as any)?.date
        ? new Date((n.trigger as any).date)
        : undefined,
  }));
}

// ── Cancel all ──────────────────────────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
