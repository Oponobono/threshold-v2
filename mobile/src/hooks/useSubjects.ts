import { useState, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDataStore } from '../store/useDataStore';
import { getSemesterSummary, SemesterSummary } from '../services/api/analytics';
import { SCALE_MAX } from '../utils/grades';

export const getStatusColor = (minNeeded: number, target: number) => {
  const maxScale = target <= 5 ? 5 : target <= 10 ? 10 : 100;
  if (minNeeded > maxScale) return '#FF2D55';
  if (minNeeded > target) return '#FF9500';
  return '#34C759';
};

export const getPillColor = (s: any, index: number): string => {
  const PILL_COLORS = ['#5856D6', '#FF9500', '#34C759', '#FF2D55', '#AF52DE', '#FF3B30'];
  return s.color || PILL_COLORS[index % PILL_COLORS.length];
};

export const getStatus = (minNeeded: number, target: number, t: any) => {
  const maxScale = target <= 5 ? 5 : target <= 10 ? 10 : 100;
  if (minNeeded > maxScale) return t('subjects.statusImpossible') || 'Inalcanzable';
  if (minNeeded > target) return t('subjects.statusAtRisk') || 'Exigente / En Riesgo';
  return t('subjects.statusSafe') || 'Seguro / Alcanzable';
};

function parseDateOrFail(dateStr: string): number {
  if (!dateStr) return NaN;
  // ISO YYYY-MM-DD → native Date (correct)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const ts = new Date(dateStr).getTime();
    if (!isNaN(ts) && ts >= -2208988800000) return ts;
  }
  // DD-MM-YYYY → manual parse (DD is day, never MM)
  const dashP = dateStr.split('-');
  if (dashP.length === 3) {
    const [d, m, y] = dashP.map(Number);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      const ts = new Date(y, m - 1, d).getTime();
      if (!isNaN(ts)) return ts;
    }
  }
  // DD/MM/YYYY → manual parse
  const slashP = dateStr.split('/');
  if (slashP.length === 3) {
    const [d, m, y] = slashP.map(Number);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      const ts = new Date(y, m - 1, d).getTime();
      if (!isNaN(ts)) return ts;
    }
  }
  return NaN;
}

function getRelativeTime(dateStr: string, t: any): string {
  const then = parseDateOrFail(dateStr);
  if (isNaN(then)) return '—';
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return '—';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('subjects.timeJustNow');
  if (diffMin < 60) return t('subjects.timeMinutesAgo', { count: diffMin });
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return t('subjects.timeHoursAgo', { count: diffHrs });
  const diffDays = Math.floor(diffHrs / 24);
  return t('subjects.timeDaysAgo', { count: diffDays });
}

export function useSubjects(t: any) {
  const { subjects, assessments, loadAllData } = useDataStore();

  const [search, setSearch] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [semesterSummary, setSemesterSummary] = useState<SemesterSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      InteractionManager.runAfterInteractions(() => {
        loadAllData();
        getSemesterSummary()
          .then(setSemesterSummary)
          .catch(() => setSemesterSummary(null));
      });
    }, [loadAllData])
  );

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
    (s.professor && s.professor.toLowerCase().includes(search.toLowerCase()))
  );

  const localCriticalSubjects = useMemo(() => {
    return subjects
      .map(s => {
        const raw = s.avg_score ?? 0;
        const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
        return { ...s, computedAvg: avg };
      })
      .filter(s => s.computedAvg < 3.0)
      .sort((a, b) => a.computedAvg - b.computedAvg)
      .slice(0, 3);
  }, [subjects]);

  const localTotalCredits = useMemo(() => {
    return subjects.reduce((sum, s) => sum + (s.credits || 0), 0);
  }, [subjects]);

  const localRecentActivity = useMemo(() => {
    return [...assessments]
      .filter(a => a.date)
      .sort((a, b) => parseDateOrFail(b.date || '') - parseDateOrFail(a.date || ''))
      .slice(0, 5)
      .map(a => {
        const subject = subjects.find(s => s.id === a.subject_id);
        return {
          ...a,
          subjectName: subject?.name || '—',
          subjectColor: subject?.color || '#5856D6',
          relativeTime: getRelativeTime(a.date || '', t),
        };
      });
  }, [assessments, subjects, t]);

  const criticalSubjects = useMemo(() => {
    if (semesterSummary?.criticalSubjects) {
      return semesterSummary.criticalSubjects.map(cs => ({
        id: cs.id,
        name: cs.name,
        avg_score: cs.avgScore,
        target_grade: cs.targetGrade,
        color: cs.color,
        icon: cs.icon,
      }));
    }
    return localCriticalSubjects;
  }, [semesterSummary, localCriticalSubjects]);

  const totalCredits = semesterSummary?.totalCredits ?? localTotalCredits;

  const recentActivity = useMemo(() => {
    if (semesterSummary?.recentActivity) {
      return semesterSummary.recentActivity.map(ra => ({
        id: ra.id,
        name: ra.name,
        subject_id: ra.subjectId,
        subjectName: ra.subjectName,
        subjectColor: ra.subjectColor,
        date: ra.date,
        relativeTime: getRelativeTime(ra.date, t),
      }));
    }
    return localRecentActivity;
  }, [semesterSummary, localRecentActivity, t]);

  return {
    subjects, filteredSubjects, criticalSubjects,
    totalCredits, recentActivity,
    search, setSearch,
    overlayVisible, setOverlayVisible,
    overlayText, setOverlayText,
  };
}
