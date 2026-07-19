import { useMemo } from 'react';
import { useDataStore } from '../store/useDataStore';
import type { Schedule } from '../services/database/repositories';

export interface NextClassInfo {
  schedule: Schedule;
  subjectName: string;
  subjectId: string;
  start_time: string;
  end_time: string;
}

export function useNextClass(): NextClassInfo | null {
  const schedules = useDataStore(s => s.schedules);
  const subjects = useDataStore(s => s.subjects);

  return useMemo(() => {
    if (!Array.isArray(schedules) || schedules.length === 0) return null;

    const today = new Date().getDay();
    const todaySchedules = schedules.filter((s: Schedule) => s.day_of_week === today);
    if (todaySchedules.length === 0) return null;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const next = todaySchedules.find((s: Schedule) => (s.end_time ?? '') >= currentTime);
    if (!next) return null;

    const subject = subjects.find(s => s.id === next.subject_id);

    return {
      schedule: next,
      subjectName: subject?.name || next.name || 'Materia',
      subjectId: next.subject_id || '',
      start_time: next.start_time || '',
      end_time: next.end_time || '',
    };
  }, [schedules, subjects]);
}
