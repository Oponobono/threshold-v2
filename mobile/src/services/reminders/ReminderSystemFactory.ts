import { PolicyRegistry } from './policies/PolicyRegistry';
import { AssessmentPolicy } from './policies/AssessmentPolicy';
import { ClassPolicy } from './policies/ClassPolicy';
import { ReviewPolicy } from './policies/ReviewPolicy';
import { EventPolicy } from './policies/EventPolicy';
import { SequenceFactory } from './SequenceFactory';
import { ReminderSnapshotAssembler } from './ReminderSnapshotAssembler';
import { SystemClock } from './Clock';
import { InterruptionPolicy } from './InterruptionPolicy';
import { TemplateResolver } from './TemplateResolver';
import { NotificationReconciler } from './NotificationReconciler';
import { ReminderEngine } from './ReminderEngine';
import { ReminderCoordinator } from './ReminderCoordinator';
import type { EntityRepository } from './ReminderCoordinator';
import { ReminderSnapshotBuilder } from './ReminderSnapshotBuilder';
import type { ReminderEntityRepositories } from './ReminderSnapshotBuilder';
import type { Clock } from './Clock';
import type { I18nService } from './I18nService';
import type { NotificationProvider } from './NotificationProvider';
import type { PerformanceObserver } from './PerformanceObserver';
import type { ReminderPreferences } from './ReminderPreferences';

export async function createDefaultReminderCoordinator(
  provider?: NotificationProvider,
  options?: { clock?: Clock; i18n?: I18nService; observer?: PerformanceObserver },
): Promise<ReminderCoordinator> {
  const clock = options?.clock ?? new SystemClock();
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());

  const assembler = new ReminderSnapshotAssembler();
  const factory = new SequenceFactory(clock, assembler);
  const interruption = new InterruptionPolicy(clock);

  const i18n: I18nService = options?.i18n ?? {
    translate(key: string, params?: Record<string, any>): string {
      return params?.default ?? key;
    },
  };
  const templates = new TemplateResolver(i18n);
  const reconciler = new NotificationReconciler();

  const resolvedProvider = provider ?? (() => {
    const { ExpoNotificationProvider } = require('./NotificationProvider');
    return new ExpoNotificationProvider();
  })();

  await resolvedProvider.setupChannels();
  console.log('[ReminderFactory] Notification channels created');

  const permissionsGranted = await resolvedProvider.requestPermissions();
  console.log(`[ReminderFactory] Notification permissions: ${permissionsGranted ? 'granted' : 'denied'}`);

  resolvedProvider.setForegroundHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  console.log('[ReminderFactory] Foreground notification handler registered');

  const engine = new ReminderEngine(
    registry,
    factory,
    interruption,
    templates,
    reconciler,
    resolvedProvider,
    clock,
    createPreferencesProvider(),
  );

  const snapshotRepos = createDefaultSnapshotRepos();
  const coordinatorRepos = loadDefaultCoordinatorRepos();
  const snapshotBuilder = new ReminderSnapshotBuilder(snapshotRepos);

  return new ReminderCoordinator(engine, snapshotBuilder, coordinatorRepos, options?.observer);
}

export function createDefaultSnapshotRepos(): ReminderEntityRepositories {
  const { assessmentRepository } = require('../database/repositories/AssessmentRepository');
  const { scheduleRepository } = require('../database/repositories/ScheduleRepository');
  const { flashcardDeckRepository } = require('../database/repositories/FlashcardDeckRepository');
  const { calendarEventRepository } = require('../database/repositories/CalendarEventRepository');
  const { subjectRepository } = require('../database/repositories/SubjectRepository');
  return {
    assessments: assessmentRepository,
    schedules: scheduleRepository,
    flashcard_decks: flashcardDeckRepository,
    calendar_events: calendarEventRepository,
    subjects: subjectRepository,
  };
}

function loadDefaultCoordinatorRepos(): Record<string, EntityRepository> {
  const { assessmentRepository } = require('../database/repositories/AssessmentRepository');
  const { scheduleRepository } = require('../database/repositories/ScheduleRepository');
  const { flashcardDeckRepository } = require('../database/repositories/FlashcardDeckRepository');
  const { calendarEventRepository } = require('../database/repositories/CalendarEventRepository');
  return {
    assessment: assessmentRepository,
    schedule: scheduleRepository,
    flashcard_deck: flashcardDeckRepository,
    calendar_event: calendarEventRepository,
  };
}

function createPreferencesProvider(): () => ReminderPreferences {
  const { getReminderPreferencesService } = require('./ReminderPreferencesService');
  const service = getReminderPreferencesService();
  return () => service.get();
}
