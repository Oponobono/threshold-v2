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
const DUEDECK_PREFIX = 'duedeck_';

// ── Init ────────────────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
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

function dueDeckId(deckId: number): string {
  return `${DUEDECK_PREFIX}${deckId}`;
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

// ── Due deck notifications ──────────────────────────────────────────────────────

export async function scheduleDueDeckNotification(
  deckId: number,
  deckTitle: string,
  dueCount: number,
): Promise<string | undefined> {
  const granted = await requestPermissions();
  if (!granted) return undefined;

  const id = await Notifications.scheduleNotificationAsync({
    identifier: dueDeckId(deckId),
    content: {
      title: i18n.t('notifications.dueDeckTitle'),
      body: i18n.t('notifications.dueDeckBody', { title: deckTitle, count: dueCount }),
      data: { deckId, type: 'duedeck' },
      sound: true,
    },
    trigger: { seconds: 60, channelId: 'default', type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL },
  });
  return id;
}

export async function cancelDueDeckNotification(deckId: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(dueDeckId(deckId));
}

export async function cancelAllDueDeckNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(DUEDECK_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
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
