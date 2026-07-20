import { PolicyRegistry } from './policies/PolicyRegistry';
import { AssessmentPolicy } from './policies/AssessmentPolicy';
import { ClassPolicy } from './policies/ClassPolicy';
import { ReviewPolicy } from './policies/ReviewPolicy';
import { EventPolicy } from './policies/EventPolicy';
import { GradingPolicy } from './policies/GradingPolicy';
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

export function createDefaultReminderCoordinator(
  provider?: NotificationProvider,
  options?: { clock?: Clock; i18n?: I18nService; observer?: PerformanceObserver },
): ReminderCoordinator {
  const clock = options?.clock ?? new SystemClock();
  const registry = new PolicyRegistry();
  registry.register(new AssessmentPolicy());
  registry.register(new ClassPolicy());
  registry.register(new ReviewPolicy());
  registry.register(new EventPolicy());
  registry.register(new GradingPolicy());

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

  const engine = new ReminderEngine(
    registry,
    factory,
    interruption,
    templates,
    reconciler,
    resolvedProvider,
    clock,
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
  const { gradingPeriodRepository } = require('../database/repositories/GradingPeriodRepository');
  const { calendarEventRepository } = require('../database/repositories/CalendarEventRepository');
  const { subjectRepository } = require('../database/repositories/SubjectRepository');
  return {
    assessments: assessmentRepository,
    schedules: scheduleRepository,
    flashcard_decks: flashcardDeckRepository,
    grading_periods: gradingPeriodRepository,
    calendar_events: calendarEventRepository,
    subjects: subjectRepository,
  };
}

function loadDefaultCoordinatorRepos(): Record<string, EntityRepository> {
  const { assessmentRepository } = require('../database/repositories/AssessmentRepository');
  const { scheduleRepository } = require('../database/repositories/ScheduleRepository');
  const { flashcardDeckRepository } = require('../database/repositories/FlashcardDeckRepository');
  const { gradingPeriodRepository } = require('../database/repositories/GradingPeriodRepository');
  const { calendarEventRepository } = require('../database/repositories/CalendarEventRepository');
  return {
    assessment: assessmentRepository,
    schedule: scheduleRepository,
    flashcard_deck: flashcardDeckRepository,
    grading_period: gradingPeriodRepository,
    calendar_event: calendarEventRepository,
  };
}
