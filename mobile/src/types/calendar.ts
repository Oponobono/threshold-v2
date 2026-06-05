export interface ScheduleItem {
  id: string;
  type: 'class' | 'task' | 'event';
  title: string;
  color: string;
  start_time: string;
  end_time: string;
  subject_id?: string;
  time?: string;
  eventType?: string;
  assessmentId?: string;
  assessmentData?: any;
  count?: number;
  allAssessments?: any[];
  description?: string;
  allDay?: boolean;
}

export interface CalendarEventItem {
  id: string;
  type: 'class' | 'task' | 'event';
  title: string;
  color: string;
  start_time: string;
  end_time: string;
  time?: string;
  subject_id?: string;
  eventType?: string;
  assessmentId?: string;
  assessmentData?: any;
  count?: number;
  allAssessments?: any[];
  description?: string;
  allDay?: boolean;
}

export interface ActivitySummary {
  hasClasses: boolean;
  hasTasks: boolean;
  hasEvents: boolean;
}

export interface DayScheduleParams {
  day: number;
  viewYear: number;
  viewMonth: number;
  allSchedules: any[];
  allAssessments: any[];
  calendarEvents: any[];
  t: any;
}
