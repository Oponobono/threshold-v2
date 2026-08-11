export type AgendaItemKind = 'class' | 'assessment' | 'calendar_event';
export type AssessmentType = 'exam' | 'task' | 'project' | 'quiz' | 'presentation' | 'other' | string; // Fallback to string for existing data
export type AssessmentStatus = 'pending' | 'completed' | 'graded';

export type CalendarScope = 
  | { kind: 'all' }
  | { kind: 'subject'; subjectId: string }
  | { kind: 'general' };
export interface AgendaItem {
  id: string;
  kind: AgendaItemKind;
  title: string;
  
  subjectId?: string;
  subject?: string;
  subjectColor?: string;
  
  start: string;
  end?: string;
  allDay: boolean;
  
  type?: AssessmentType; // e.g., 'exam', 'task'
  status?: {
    is_completed?: boolean;
    state?: AssessmentStatus;
  };
  
  location?: string;
  
  // App-specific internal flags not strictly in the base UX contract but needed for logic
  time_label?: string; 
  linked_deck_id?: string;
  weight?: number;
}

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
  linked_deck_id?: string;
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
  linked_deck_id?: string;
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
