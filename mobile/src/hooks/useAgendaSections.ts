import { useMemo } from 'react';
import { AgendaItem } from '../types/calendar';

const parseTime = (timeStr: string) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

const isBeforeDay = (d1: Date, d2: Date) => {
  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  return t1 < t2;
};

export const useAgendaSections = (events: AgendaItem[], selectedDate: Date) => {
  return useMemo(() => {
    const allDay: AgendaItem[] = [];
    const upcoming: AgendaItem[] = [];
    const past: AgendaItem[] = [];

    const now = new Date();
    const isToday = isSameDay(selectedDate, now);
    const isPastDay = isBeforeDay(selectedDate, now);
    const isFutureDay = !isToday && !isPastDay;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const item of events) {
      if (item.allDay) {
        allDay.push(item);
        continue;
      }

      if (isPastDay) {
        past.push(item);
      } else if (isFutureDay) {
        upcoming.push(item);
      } else {
        // Today
        // Try to use end time if available, otherwise start time
        const timeToCompare = item.end ? parseTime(item.end) : parseTime(item.start);
        if (timeToCompare < currentMinutes) {
          past.push(item);
        } else {
          upcoming.push(item);
        }
      }
    }

    // Sort is already guaranteed by useCalendar hook (chronological ASC), 
    // but just in case we enforce it again.
    const sortByStart = (a: AgendaItem, b: AgendaItem) => a.start.localeCompare(b.start);
    
    allDay.sort(sortByStart);
    upcoming.sort(sortByStart);
    past.sort(sortByStart); // "Nunca se invierte el orden dentro de Pasados."

    const pastDefaultExpanded = upcoming.length === 0 && allDay.length === 0;

    return {
      allDayEvents: allDay,
      upcomingEvents: upcoming,
      pastEvents: past,
      pastDefaultExpanded
    };
  }, [events, selectedDate]);
};
