import * as ExpoNotifications from 'expo-notifications';
import { PermissionsAndroid, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import ThresholdExactAlarm from '../../../modules/threshold-exact-alarm/src';
import { getReminderCoordinator } from './reminderCoordinatorInstance';
import { ReminderSnapshotBuilder } from './ReminderSnapshotBuilder';
import { createDefaultSnapshotRepos } from './ReminderSystemFactory';
import { scheduleRepository } from '../database/repositories/ScheduleRepository';
import { assessmentRepository } from '../database/repositories/AssessmentRepository';
import { calendarEventRepository } from '../database/repositories/CalendarEventRepository';
import { flashcardDeckRepository } from '../database/repositories/FlashcardDeckRepository';
import type {
  ReminderDiagnosticsData,
  ExpectedPlanItem,
  OsScheduledItem,
  ExactAlarmCapability,
} from './ReminderDiagnosticsCore';
import { computeDiff, computeCanScheduleExactAlarms } from './ReminderDiagnosticsCore';

let deliverySubscription: { remove: () => void } | null = null;

const STRESS_PREFIX = 'stress-';

export interface OSStressResult {
  readonly attempted: number;
  readonly scheduled: number;
  readonly acceptedByOS: number;
  readonly limitReachedAt: number | null;
}

function triggerDateOf(trigger: any): Date | null {
  if (!trigger) return null;
  if ('date' in trigger) return trigger.date instanceof Date ? trigger.date : new Date(trigger.date as number);
  if ('value' in trigger) return trigger.value instanceof Date ? trigger.value : new Date(trigger.value as number);
  if ('seconds' in trigger) return new Date(Date.now() + (trigger.seconds as number) * 1000);
  return null;
}

async function checkPermission(permission: string): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  try {
    return await PermissionsAndroid.check(permission as any);
  } catch {
    return null;
  }
}

async function readCanScheduleExactAlarmsNative(): Promise<boolean | null> {
  if (Platform.OS !== 'android') return null;
  try {
    return await ThresholdExactAlarm.canScheduleExactAlarms();
  } catch {
    return null;
  }
}

export async function collectExactAlarmCapability(): Promise<ExactAlarmCapability> {
  const sdk = Platform.OS === 'android' && typeof Platform.Version === 'number' ? Platform.Version : null;
  const scheduleExactAlarmGranted = await checkPermission('android.permission.SCHEDULE_EXACT_ALARM');
  const useExactAlarmGranted = await checkPermission('android.permission.USE_EXACT_ALARM');
  const nativeCanSchedule = await readCanScheduleExactAlarmsNative();
  const canScheduleExactAlarms =
    nativeCanSchedule !== null && nativeCanSchedule !== undefined
      ? nativeCanSchedule
      : computeCanScheduleExactAlarms(sdk, scheduleExactAlarmGranted, useExactAlarmGranted);
  return {
    platform: Platform.OS,
    sdk,
    manufacturer: Device.manufacturer,
    modelName: Device.modelName,
    scheduleExactAlarmGranted,
    useExactAlarmGranted,
    canScheduleExactAlarms,
    nativeCanScheduleExactAlarms: nativeCanSchedule,
    batteryOptimizationIgnored: null,
    dozeWhitelisted: null,
  };
}

export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const applicationId = Application.applicationId;
  if (!applicationId) return;
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
      data: `package:${applicationId}`,
    });
  } catch (e: any) {
    console.log(`[EXACT-ALARM] ACTION_REQUEST_SCHEDULE_EXACT_ALARM failed (${e?.message ?? String(e)}); falling back to app details`);
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
      data: `package:${applicationId}`,
    }).catch(() => {});
  }
}

export interface ExactAlarmRequestResult {
  readonly grantedBefore: boolean | null;
  readonly grantedAfter: boolean | null;
  readonly resynced: boolean;
  readonly capability: ExactAlarmCapability;
}

export async function requestExactAlarmPermission(): Promise<ExactAlarmRequestResult> {
  const before = await collectExactAlarmCapability();
  await openExactAlarmSettings();
  const after = await collectExactAlarmCapability();
  const grantedBefore = before.canScheduleExactAlarms;
  const grantedAfter = after.canScheduleExactAlarms;
  let resynced = false;
  if (grantedBefore === false && grantedAfter === true) {
    const coordinator = await getReminderCoordinator();
    await coordinator.resync();
    resynced = true;
  }
  console.log(
    `[EXACT-ALARM] request result: grantedBefore=${grantedBefore} grantedAfter=${grantedAfter} resynced=${resynced}`,
  );
  return { grantedBefore, grantedAfter, resynced, capability: after };
}

export async function collectReminderDiagnostics(): Promise<ReminderDiagnosticsData> {
  const coordinator = await getReminderCoordinator();
  const engine = coordinator.getEngine();

  const snapshot = await new ReminderSnapshotBuilder(createDefaultSnapshotRepos()).build();
  const plan = await engine.computeCurrentPlan(snapshot);

  const [schedules, assessments, events, decks] = await Promise.all([
    scheduleRepository.getAll().catch(() => []),
    assessmentRepository.getAll().catch(() => []),
    calendarEventRepository.getAll().catch(() => []),
    flashcardDeckRepository.getAll().catch(() => []),
  ]);

  const expected: ExpectedPlanItem[] = plan.deliverables.map((d) => ({
    id: d.id,
    scheduledAt: d.scheduledAt.toISOString(),
    entityType: d.entityType,
    entityId: d.entityId,
    intent: d.intent,
    priority: d.priority,
    title: d.title,
  }));

  let osScheduled: OsScheduledItem[] = [];
  let osRaw: { identifier: string; triggerDate: Date | null }[] = [];
  try {
    const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
    osScheduled = scheduled.map((n) => ({
      identifier: n.identifier,
      title: n.content.title ?? '',
      body: n.content.body ?? '',
      triggerDate: triggerDateOf(n.trigger)?.toISOString() ?? null,
    }));
    osRaw = scheduled.map((n) => ({
      identifier: n.identifier,
      triggerDate: triggerDateOf(n.trigger),
    }));
  } catch {}

  const diff = computeDiff(
    plan.deliverables.map((d) => ({ id: d.id, scheduledAt: d.scheduledAt })),
    osRaw,
  );

  const tz = Intl.DateTimeFormat().resolvedOptions();
  const exactAlarm = await collectExactAlarmCapability();

  return {
    collectedAt: new Date().toISOString(),
    timezone: {
      name: tz.timeZone ?? 'unknown',
      offsetMinutes: new Date().getTimezoneOffset(),
    },
    engineAlive: coordinator.isInitialized,
    exactAlarm,
    raw: {
      schedules: schedules.map((s: any) => ({
        id: String(s.id),
        day_of_week: s.day_of_week ?? null,
        start_time: s.start_time ?? null,
        end_time: s.end_time ?? null,
        subject_id: s.subject_id,
      })),
      assessments: assessments.map((a: any) => ({
        id: String(a.id),
        name: a.name ?? '',
        date: a.date ?? null,
        due_date: a.due_date ?? null,
        is_completed: a.is_completed ?? null,
      })),
      calendar_events: events.map((e: any) => ({
        id: String(e.id),
        title: e.title ?? '',
        start_date: e.start_date ?? null,
        end_date: e.end_date ?? null,
        all_day: e.all_day ?? null,
      })),
      flashcard_decks: decks.map((fk: any) => ({
        id: String(fk.id),
        title: fk.title ?? '',
        card_count: fk.card_count ?? null,
      })),
    },
    plan: expected,
    osScheduled,
    diff,
  };
}

export function isReminderDeliveryLoggingEnabled(): boolean {
  return deliverySubscription !== null;
}

export async function runOSStressTest(count: number): Promise<OSStressResult> {
  let scheduled = 0;
  let acceptedByOS = 0;
  let limitReachedAt: number | null = null;

  for (let i = 0; i < count; i++) {
    const id = STRESS_PREFIX + i;
    const trigger = new Date(Date.now() + (i + 1) * 60000);
    try {
      await ExpoNotifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: `[STRESS] #${i}`,
          body: `synthetic reminder ${i} of ${count}`,
          sound: false,
        },
        trigger: {
          type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
          date: trigger,
        },
      });
      scheduled++;
    } catch (e: any) {
      limitReachedAt = i;
      console.log(`[STRESS] schedule failed at #${i}: ${e?.message ?? String(e)}`);
      break;
    }
  }

  const all = await ExpoNotifications.getAllScheduledNotificationsAsync().catch(() => []);
  acceptedByOS = all.filter((n) => n.identifier.startsWith(STRESS_PREFIX)).length;

  const result: OSStressResult = {
    attempted: count,
    scheduled,
    acceptedByOS,
    limitReachedAt,
  };
  console.log(`[STRESS] attempted=${result.attempted} scheduled=${result.scheduled} acceptedByOS=${result.acceptedByOS} limitReachedAt=${result.limitReachedAt ?? 'none'}`);
  return result;
}

export async function clearOSStressTest(): Promise<number> {
  const all = await ExpoNotifications.getAllScheduledNotificationsAsync().catch(() => []);
  const toCancel = all.filter((n) => n.identifier.startsWith(STRESS_PREFIX)).map((n) => n.identifier);
  await Promise.all(toCancel.map((id) => ExpoNotifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  console.log(`[STRESS] cleared ${toCancel.length} synthetic notifications`);
  return toCancel.length;
}

export function enableReminderDeliveryLogging(): void {
  if (deliverySubscription) return;
  deliverySubscription = ExpoNotifications.addNotificationReceivedListener((n) => {
    const id = n.request.identifier;
    const title = n.request.content.title ?? '';
    const body = n.request.content.body ?? '';
    const receivedAt = new Date();
    console.log(
      `[DELIVERY] id=${id} | title=${title} | body=${body} | receivedAt=${receivedAt.toISOString()} | now=${Date.now()}`,
    );
  });
  console.log('[DELIVERY] logger enabled');
}

export function disableReminderDeliveryLogging(): void {
  if (deliverySubscription) {
    deliverySubscription.remove();
    deliverySubscription = null;
    console.log('[DELIVERY] logger disabled');
  }
}
