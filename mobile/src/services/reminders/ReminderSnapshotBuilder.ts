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
  subjects?: { getAll(): Promise<{ id: string; name: string }[]> };
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
      subjects,
    ] = await Promise.all([
      this.repos.assessments.getAll(),
      this.repos.schedules.getAll(),
      this.repos.flashcard_decks.getAll(),
      this.repos.grading_periods.getAll(),
      this.repos.calendar_events.getAll(),
      this.repos.subjects?.getAll() ?? Promise.resolve([]),
    ]);

    const subjectMap = new Map<string, string>();
    for (const s of subjects) {
      subjectMap.set(String(s.id), s.name);
    }

    const enrichedSchedules = (schedules as readonly any[]).map((sched) => ({
      ...sched,
      subject_name: subjectMap.get(String(sched.subject_id)) ?? '',
    }));

    return {
      assessments: assessments as readonly any[],
      schedules: enrichedSchedules as readonly any[],
      flashcard_decks: flashcardDecks as readonly any[],
      grading_periods: gradingPeriods as readonly any[],
      calendar_events: calendarEvents as readonly any[],
    };
  }
}
