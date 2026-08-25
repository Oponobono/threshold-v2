import { useState, useEffect, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { useDataStore } from '../store/useDataStore';
import { AgendaItem, ActivitySummary } from '../types/calendar';

export const TODAY = new Date();

export function useCalendar(t: any, language: string = 'es-ES') {
  const [viewMonth, setViewMonth] = useState(TODAY.getMonth());
  const [viewYear, setViewYear] = useState(TODAY.getFullYear());
  const [selectedDayNum, setSelectedDayNum] = useState(TODAY.getDate());

  const storeCalendarEvents = useDataStore(s => s.calendarEvents);
  const { schedules: allSchedules, assessments: allAssessments, subjects, loadAllData } = useDataStore();

  const [calendarEvents, setCalendarEvents] = useState<any[]>(storeCalendarEvents);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
      loadAllData();
    });
    return () => task.cancel();
  }, [loadAllData]);

  useEffect(() => {
    if (storeCalendarEvents.length > 0) {
      setCalendarEvents(storeCalendarEvents);
    }
  }, [storeCalendarEvents]);

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

  const getDaySchedule = useCallback((day: number): AgendaItem[] => {
    const date = new Date(viewYear, viewMonth, day);
    let dayOfWeek = date.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7;

    const rawClasses: AgendaItem[] = allSchedules.filter(s => s.day_of_week === dayOfWeek).map(s => {
      const subject = subjects?.find((sub: any) => sub.id === s.subject_id);
      return {
        id: `class-${s.id}`,
        kind: 'class',
        title: subject?.name || (s as any).name || t('calendar.defaultClassTitle'),
        subjectId: s.subject_id,
        subject: subject?.name,
        subjectColor: subject?.color || (s as any).color || '#2F80ED',
        start: s.start_time || '00:00',
        end: s.end_time,
        time_label: `${s.start_time || ''} - ${s.end_time || ''}`,
        allDay: false
      };
    });

    const classMap = new Map<string, AgendaItem>();
    rawClasses.forEach(cls => {
      if (cls.subjectId && classMap.has(cls.subjectId)) {
        const existing = classMap.get(cls.subjectId)!;
        const est = existing.start;
        const cst = cls.start;
        const eet = existing.end;
        const cet = cls.end;
        const newStartTime = est !== undefined && cst !== undefined && cst < est ? cst : est;
        const newEndTime = eet !== undefined && cet !== undefined && cet > eet ? cet : eet;
        existing.start = newStartTime;
        existing.end = newEndTime;
        existing.time_label = `${newStartTime} - ${newEndTime}`;
      } else if (cls.subjectId) {
        classMap.set(cls.subjectId, cls);
      }
    });

    const classes = Array.from(classMap.values());

    const dd = day.toString().padStart(2, '0');
    const mm = (viewMonth + 1).toString().padStart(2, '0');
    const yyyy = viewYear.toString();
    const dateStrDMY = `${dd}-${mm}-${yyyy}`;
    const dateStrISO = `${yyyy}-${mm}-${dd}`;

    const tasks: AgendaItem[] = (allAssessments as any[])
      .filter((a: any) => a.date === dateStrDMY || a.date === dateStrISO)
      .map((a: any) => {
        const subject = subjects?.find((sub: any) => sub.id === a.subject_id);
        const isTask = a.type === 'task';
        const isAllDay = isTask && (!a.time || a.time === '--:--' || a.time === t('calendar.allDay'));
        return {
          id: `assessment-${a.id}`,
          kind: 'assessment',
          title: a.name,
          subjectId: a.subject_id,
          subject: subject?.name,
          subjectColor: a.subject_color || subject?.color || '#FF9500',
          start: isAllDay ? '00:00' : (a.time || '23:59'),
          time_label: isTask ? (a.time || t('calendar.allDay')) : (a.type || t('calendar.defaultAssessmentTitle')),
          allDay: isAllDay,
          type: a.type,
          weight: a.weight,
          status: {
            is_completed: a.is_completed
          }
        };
      });

    const targetDate = `${dd}-${mm}-${yyyy}`;

    const calendarDayEvents: AgendaItem[] = (calendarEvents || [])
      .filter((event: any) => event.startDate === targetDate || event.start_date === targetDate)
      .map((event: any) => {
        const isAllDay = event.allDay || event.all_day;
        const sTime = event.startTime || event.start_time || '08:00';
        const eTime = event.endTime || event.end_time || '09:00';
        return {
          id: `event-${event.id}`,
          kind: 'calendar_event',
          title: event.title,
          subjectId: event.subjectId || event.subject_id,
          subjectColor: event.subjectColor || event.subject_color || '#A2845E',
          start: isAllDay ? '00:00' : sTime,
          end: isAllDay ? undefined : eTime,
          time_label: isAllDay ? t('calendar.allDay') : `${sTime} - ${eTime}`,
          allDay: isAllDay,
          linked_deck_id: event.linked_deck_id || event.deckId
        };
      });

    // Deterministic sort:
    // 1. All-day events first
    // 2. Chronological by start
    // 3. Fallback to kind ('class' > 'assessment' > 'calendar_event')
    // 4. Fallback to title
    return [...classes, ...tasks, ...calendarDayEvents].sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      
      const timeCompare = a.start.localeCompare(b.start);
      if (timeCompare !== 0) return timeCompare;

      if (a.kind !== b.kind) {
        const kindRank: Record<string, number> = { class: 1, assessment: 2, calendar_event: 3 };
        return (kindRank[a.kind] || 4) - (kindRank[b.kind] || 4);
      }

      return a.title.localeCompare(b.title);
    });
  }, [allSchedules, allAssessments, calendarEvents, subjects, viewYear, viewMonth, t]);

  const getActivitySummary = useCallback((day: number): ActivitySummary => {
    const schedule = getDaySchedule(day);
    return {
      hasClasses: schedule.some((item: any) => item.kind === 'class'),
      hasTasks: schedule.some((item: any) => item.kind === 'assessment'),
      hasEvents: schedule.some((item: any) => item.kind === 'calendar_event'),
    };
  }, [getDaySchedule]);

  const filteredEvents = useMemo(
    () => getDaySchedule(selectedDayNum),
    [getDaySchedule, selectedDayNum]
  );

  const isToday = (day: number) =>
    isViewingCurrentMonth && day === TODAY.getDate();

  const reloadEventsForMonth = useCallback(() => {
    setCalendarEvents(useDataStore.getState().calendarEvents);
  }, []);

  return {
    viewMonth, setViewMonth,
    viewYear, setViewYear,
    selectedDayNum, setSelectedDayNum,
    calendarEvents, setCalendarEvents,
    isReady,
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
