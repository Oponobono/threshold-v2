import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataStore } from '../store/useDataStore';
import { getCalendarEvents } from '../services/api/calendar';
import { ScheduleItem, ActivitySummary } from '../types/calendar';

export const TODAY = new Date();

export function useCalendar(t: any, language: string = 'es-ES') {
  const [viewMonth, setViewMonth] = useState(TODAY.getMonth());
  const [viewYear, setViewYear] = useState(TODAY.getFullYear());
  const [selectedDayNum, setSelectedDayNum] = useState(TODAY.getDate());

  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const { schedules: allSchedules, assessments: allAssessments, loadAllData } = useDataStore();

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const loadEventsForMonth = async () => {
      try {
        setLoadingEvents(true);
        const firstDay = new Date(viewYear, viewMonth, 1);
        const lastDay = new Date(viewYear, viewMonth + 1, 0);

        const startDateStr = formatDateStr(firstDay);
        const endDateStr = formatDateStr(lastDay);

        const events = await getCalendarEvents(startDateStr, endDateStr);
        setCalendarEvents(events || []);
      } catch (error) {
        console.warn('Error cargando eventos del calendario:', error);
        setCalendarEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEventsForMonth();
  }, [viewYear, viewMonth]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayRaw = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleString(language === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' });

  const isViewingCurrentMonth =
    viewMonth === TODAY.getMonth() && viewYear === TODAY.getFullYear();

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
    setSelectedDayNum(1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
    setSelectedDayNum(1);
  };

  const goToToday = () => {
    setViewMonth(TODAY.getMonth());
    setViewYear(TODAY.getFullYear());
    setSelectedDayNum(TODAY.getDate());
  };

  const getDaySchedule = useCallback((day: number): ScheduleItem[] => {
    const date = new Date(viewYear, viewMonth, day);
    let dayOfWeek = date.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    const rawClasses = allSchedules.filter(s => s.day_of_week === dayOfWeek).map(s => ({
      id: s.id,
      type: 'class' as const,
      title: (s as any).name || t('calendar.defaultClassTitle'),
      color: (s as any).color || '#2F80ED',
      start_time: s.start_time,
      end_time: s.end_time,
      subject_id: s.subject_id,
    }));

    const classMap = new Map<string, any>();
    rawClasses.forEach(cls => {
      if (cls.subject_id && classMap.has(cls.subject_id)) {
        const existing = classMap.get(cls.subject_id)!;
        const newStartTime = existing.start_time < cls.start_time ? existing.start_time : cls.start_time;
        const newEndTime = existing.end_time > cls.end_time ? existing.end_time : cls.end_time;
        existing.start_time = newStartTime;
        existing.end_time = newEndTime;
        existing.time = `${newStartTime} - ${newEndTime}`;
      } else if (cls.subject_id) {
        classMap.set(cls.subject_id, {
          ...cls,
          time: `${cls.start_time} - ${cls.end_time}`,
        });
      }
    });

    const classes = Array.from(classMap.values());

    const dd = day.toString().padStart(2, '0');
    const mm = (viewMonth + 1).toString().padStart(2, '0');
    const yyyy = viewYear.toString();
    const dateStrDMY = `${dd}-${mm}-${yyyy}`;
    const dateStrISO = `${yyyy}-${mm}-${dd}`;

    const rawTasks = (allAssessments as any[])
      .filter((a: any) => a.date === dateStrDMY || a.date === dateStrISO)
      .map((a: any) => ({
        assessmentId: a.id,
        assessmentData: a,
        title: a.name,
        time: a.type === 'task' ? (a.time || t('calendar.allDay')) : (a.type || t('calendar.defaultAssessmentTitle')),
        color: a.subject_color || '#FF9500',
        type: 'task' as const,
        start_time: '23:59',
        subject_id: a.subject_id,
      }));

    const taskMap = new Map<string, any>();
    rawTasks.forEach(task => {
      if (task.subject_id && taskMap.has(task.subject_id)) {
        const existing = taskMap.get(task.subject_id)!;
        existing.count = (existing.count || 1) + 1;
        if (!existing.allAssessments) {
          existing.allAssessments = [existing.assessmentData];
        }
        existing.allAssessments.push(task.assessmentData);
      } else if (task.subject_id) {
        taskMap.set(task.subject_id, {
          ...task,
          count: 1,
          allAssessments: [task.assessmentData],
        });
      }
    });

    const tasks = Array.from(taskMap.values()).map(task => ({
      ...task,
      id: task.assessmentId,
      title: task.count > 1
        ? `${task.title} +${task.count - 1}`
        : task.title,
    }));

    const dayStr = day.toString().padStart(2, '0');
    const monthStr = (viewMonth + 1).toString().padStart(2, '0');
    const yearStr = viewYear.toString();
    const targetDate = `${dayStr}-${monthStr}-${yearStr}`;

    const calendarDayEvents = (calendarEvents || [])
      .filter((event: any) => event.startDate === targetDate || event.start_date === targetDate)
      .map((event: any) => ({
        id: `event-${event.id}`,
        type: 'event' as const,
        eventType: event.eventType || event.event_type,
        title: event.title,
        color: event.subjectColor || event.subject_color || '#A2845E',
        start_time: event.startTime || event.start_time || '08:00',
        end_time: event.endTime || event.end_time || '09:00',
        subject_id: event.subjectId || event.subject_id,
        description: event.description,
        allDay: event.allDay || event.all_day,
        time: event.allDay || event.all_day ? t('calendar.allDay') : `${event.startTime || event.start_time || '08:00'} - ${event.endTime || event.end_time || '09:00'}`,
      }));

    return [...classes, ...tasks, ...calendarDayEvents].sort((a: any, b: any) =>
      (a.start_time || '00:00').localeCompare(b.start_time || '00:00')
    );
  }, [allSchedules, allAssessments, calendarEvents, viewYear, viewMonth, t]);

  const getActivitySummary = useCallback((day: number): ActivitySummary => {
    const schedule = getDaySchedule(day);
    return {
      hasClasses: schedule.some((item: any) => item.type === 'class'),
      hasTasks: schedule.some((item: any) => item.type === 'task'),
      hasEvents: schedule.some((item: any) => item.type === 'event'),
    };
  }, [getDaySchedule]);

  const filteredEvents = useMemo(
    () => getDaySchedule(selectedDayNum),
    [getDaySchedule, selectedDayNum]
  );

  const isToday = (day: number) =>
    isViewingCurrentMonth && day === TODAY.getDate();

  const reloadEventsForMonth = useCallback(async () => {
    try {
      const firstDay = new Date(viewYear, viewMonth, 1);
      const lastDay = new Date(viewYear, viewMonth + 1, 0);
      const startDateStr = formatDateStr(firstDay);
      const endDateStr = formatDateStr(lastDay);
      const updatedEvents = await getCalendarEvents(startDateStr, endDateStr);
      setCalendarEvents(updatedEvents || []);
    } catch (error) {
      console.warn('Error reloading events:', error);
    }
  }, [viewYear, viewMonth]);

  return {
    viewMonth, setViewMonth,
    viewYear, setViewYear,
    selectedDayNum, setSelectedDayNum,
    calendarEvents, setCalendarEvents,
    loadingEvents,
    daysInMonth,
    startOffset,
    monthLabel,
    isViewingCurrentMonth,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    getDaySchedule,
    getActivitySummary,
    filteredEvents,
    isToday,
    reloadEventsForMonth,
    loadAllData,
    allSchedules,
    allAssessments,
  };
}

function formatDateStr(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
