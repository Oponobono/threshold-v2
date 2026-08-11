import { useMemo } from 'react';
import { AgendaItem } from '../types/calendar';

export interface ActiveSubject {
  id: string;
  name: string;
  color: string;
  count: number;
}

export const useActiveSubjects = (dayEvents: AgendaItem[], subjects: any[]) => {
  return useMemo(() => {
    const subjectsById = subjects.reduce((acc, subject) => {
      acc[subject.id] = subject;
      return acc;
    }, {} as Record<string, any>);

    const map = new Map<string, ActiveSubject>();
    let hasGeneralEvents = false;
    let totalCount = dayEvents.length;

    for (const item of dayEvents) {
      if (!item.subjectId) {
        hasGeneralEvents = true;
        continue;
      }
      const existing = map.get(item.subjectId) ?? {
        id: item.subjectId,
        name: subjectsById[item.subjectId]?.name || 'Unknown',
        color: item.subjectColor || subjectsById[item.subjectId]?.color || '#888',
        count: 0
      };
      existing.count++;
      map.set(item.subjectId, existing);
    }

    const activeSubjects = Array.from(map.values()).sort((a, b) => b.count - a.count);

    return {
      activeSubjects,
      hasGeneralEvents,
      totalCount
    };
  }, [dayEvents, subjects]);
};
