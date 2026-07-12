import type { ReminderSourceSnapshot } from './types';
import type { Assessment } from '../database/repositories/AssessmentRepository';
import type { Schedule } from '../database/repositories/ScheduleRepository';
import type { FlashcardDeck } from '../database/repositories/FlashcardDeckRepository';
import type { GradingPeriod } from '../database/repositories/GradingPeriodRepository';
import type { CalendarEvent } from '../database/repositories/CalendarEventRepository';

export interface ReminderEntityRepositories {
  assessments: { getAll(): Promise<Assessment[]> };
  schedules: { getAll(): Promise<Schedule[]> };
  flashcard_decks: { getAll(): Promise<FlashcardDeck[]> };
  grading_periods: { getAll(): Promise<GradingPeriod[]> };
  calendar_events: { getAll(): Promise<CalendarEvent[]> };
}

export class ReminderSnapshotBuilder {
  private repos: ReminderEntityRepositories;

  constructor(repos: ReminderEntityRepositories) {
    this.repos = repos;
  }

  async build(): Promise<ReminderSourceSnapshot> {
    const [
      assessments,
      schedules,
      flashcardDecks,
      gradingPeriods,
      calendarEvents,
    ] = await Promise.all([
      this.repos.assessments.getAll(),
      this.repos.schedules.getAll(),
      this.repos.flashcard_decks.getAll(),
      this.repos.grading_periods.getAll(),
      this.repos.calendar_events.getAll(),
    ]);

    return {
      assessments: assessments as readonly any[],
      schedules: schedules as readonly any[],
      flashcard_decks: flashcardDecks as readonly any[],
      grading_periods: gradingPeriods as readonly any[],
      calendar_events: calendarEvents as readonly any[],
    };
  }
}
