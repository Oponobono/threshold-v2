export interface ScheduleItem {
  id: string;
  type: 'class' | 'task' | 'event';
  title: string;
  color: string;
  start_time: string;
  end_time: string;
  subject_id?: number;
  time?: string;
  eventType?: string;
  assessmentId?: number;
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
  subject_id?: number;
  eventType?: string;
  assessmentId?: number;
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
