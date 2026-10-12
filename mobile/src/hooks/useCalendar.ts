import { useState, useCallback, useMemo } from 'react';
import { useDataStore } from '../store/useDataStore';
import { AgendaItem, ActivitySummary } from '../types/calendar';
import {
  toDateId,
  toWeekday,
  extractTimeHHMM,
  buildMonthActivityIndex,
  getActivitySummaryForDay,
} from '../utils/calendarDateUtils';

export const TODAY = new Date();

export function useCalendar(t: any, language: string = 'es-ES') {
  const [viewMonth, setViewMonth] = useState(TODAY.getMonth());
  const [viewYear, setViewYear] = useState(TODAY.getFullYear());
  const [selectedDayNum, setSelectedDayNum] = useState(TODAY.getDate());

  // Selectores atómicos directos (Fase 1: elimina suscripción global y estado duplicado desfasado)
  const calendarEvents = useDataStore(s => s.calendarEvents);
  const allSchedules = useDataStore(s => s.schedules);
  const allAssessments = useDataStore(s => s.assessments);
  const subjects = useDataStore(s => s.subjects);
  const isInitialLoading = useDataStore(s => s.isInitialLoading);
  const refreshCalendarEvents = useDataStore(s => s.refreshCalendarEvents);

  const isReady = !isInitialLoading;

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
    const _t0 = __DEV__ ? performance.now() : 0;
    const date = new Date(viewYear, viewMonth, day);
    const dateWeekday = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const targetDateId = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    // 1. Clases recurrentes: normalizadas con toWeekday (0..6)
    const rawClasses: AgendaItem[] = (allSchedules || [])
      .filter(s => toWeekday(s.day_of_week) === dateWeekday)
      .map(s => {
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

    // 2. Evaluaciones / Tareas: soporte para due_at, starts_at y date legacy
    const tasks: AgendaItem[] = (allAssessments as any[])
      .filter((a: any) => {
        const dateId = toDateId(a.due_at ?? a.starts_at ?? a.date);
        return dateId === targetDateId;
      })
      .map((a: any) => {
        const subject = subjects?.find((sub: any) => sub.id === a.subject_id);
        const isTask = a.type === 'task' || a.assessment_type === 'deadline';
        const extractedTime = extractTimeHHMM(a.due_at ?? a.starts_at) || a.time;
        const isAllDay = isTask && (!extractedTime || extractedTime === '--:--' || extractedTime === t('calendar.allDay'));
        return {
          id: `assessment-${a.id}`,
          kind: 'assessment',
          title: a.name,
          subjectId: a.subject_id,
          subject: subject?.name,
          subjectColor: a.subject_color || subject?.color || '#FF9500',
          start: isAllDay ? '00:00' : (extractedTime || '23:59'),
          time_label: isTask ? (extractedTime || t('calendar.allDay')) : (a.type || t('calendar.defaultAssessmentTitle')),
          allDay: isAllDay,
          type: a.type || a.assessment_type,
          weight: a.weight,
          status: {
            is_completed: a.is_completed
          }
        };
      });

    // 3. Eventos de calendario: soporte multi-día y formatos YYYY-MM-DD / DD-MM-YYYY
    const calendarDayEvents: AgendaItem[] = (calendarEvents || [])
      .filter((event: any) => {
        const startId = toDateId(event.startDate ?? event.start_date);
        if (!startId) return false;
        const endId = toDateId(event.endDate ?? event.end_date) ?? startId;
        return targetDateId >= startId && targetDateId <= endId;
      })
      .map((event: any) => {
        const isAllDay = Boolean(event.allDay || event.all_day);
        const sTime = extractTimeHHMM(event.startTime ?? event.start_time) || '08:00';
        const eTime = extractTimeHHMM(event.endTime ?? event.end_time) || '09:00';
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
    const sorted = [...classes, ...tasks, ...calendarDayEvents].sort((a, b) => {
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

    if (__DEV__ && day === selectedDayNum) {
      const elapsedMs = performance.now() - _t0;
      console.log(`[Calendar:Phase0] getDaySchedule(${targetDateId}) tomó ${elapsedMs.toFixed(2)}ms | Raw: [sch:${allSchedules.length}, ass:${allAssessments.length}, evt:${calendarEvents.length}] -> Matched: [cls:${classes.length}, tsk:${tasks.length}, evt:${calendarDayEvents.length}] = Total ${sorted.length}`);
    }

    return sorted;
  }, [allSchedules, allAssessments, calendarEvents, subjects, viewYear, viewMonth, t, selectedDayNum]);

  // Índice O(1) calculado una sola vez al mutar los datos
  const activityIndex = useMemo(
    () => buildMonthActivityIndex(allSchedules, allAssessments, calendarEvents),
    [allSchedules, allAssessments, calendarEvents]
  );

  // Consulta instantánea O(1) en lugar de resolver la agenda completa
  const getActivitySummary = useCallback(
    (dayOrYear: number, month?: number, day?: number): ActivitySummary => {
      if (month !== undefined && day !== undefined) {
        return getActivitySummaryForDay(activityIndex, dayOrYear, month, day);
      }
      return getActivitySummaryForDay(activityIndex, viewYear, viewMonth, dayOrYear);
    },
    [activityIndex, viewYear, viewMonth]
  );

  const filteredEvents = useMemo(
    () => getDaySchedule(selectedDayNum),
    [getDaySchedule, selectedDayNum]
  );

  const isToday = (day: number) =>
    isViewingCurrentMonth && day === TODAY.getDate();

  const reloadEventsForMonth = useCallback(async () => {
    await refreshCalendarEvents().catch(() => {});
  }, [refreshCalendarEvents]);

  return {
    viewMonth, setViewMonth,
    viewYear, setViewYear,
    selectedDayNum, setSelectedDayNum,
    calendarEvents,
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
    loadAllData: useDataStore.getState().loadAllData,
    allSchedules,
    allAssessments,
  };
}
