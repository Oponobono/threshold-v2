import { useState, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDataStore } from '../store/useDataStore';
import { getSemesterSummary, SemesterSummary } from '../services/api/analytics';
import { SCALE_MAX } from '../utils/grades';
import { calculateProjection } from '../utils/projectionEngine';

export interface UnifiedActivityItem {
  id: string;
  title: string;
  subtitle: string;
  date: number;
  subjectId: number;
  subjectName?: string;
  subjectColor?: string;
  type: 'assessment' | 'flashcard' | 'study' | 'calendar';
  relativeTime?: string;
}

export const ACTIVITY_CONFIG = {
  assessment: { icon: 'clipboard-outline', color: '#3498db', label: 'Evaluación' },
  flashcard:  { icon: 'flash-outline',     color: '#e67e22', label: 'Repaso FSRS' },
  study:      { icon: 'book-open-outline', color: '#2ecc71', label: 'Sesión' },
  calendar:   { icon: 'calendar-outline',  color: '#9b59b6', label: 'Evento' },
};

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

function getRelativeTime(then: number, t: any): string {
  if (isNaN(then) || then <= 0) return '—';
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return t('subjects.timeJustNow'); // Future time? Just say now
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('subjects.timeJustNow');
  if (diffMin < 60) return t('subjects.timeMinutesAgo', { count: diffMin });
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return t('subjects.timeHoursAgo', { count: diffHrs });
  const diffDays = Math.floor(diffHrs / 24);
  return t('subjects.timeDaysAgo', { count: diffDays });
}

export function useSubjects(t: any) {
  const { subjects, assessments, loadAllData, predictions, calendarEvents, flashcardDecks, userStats } = useDataStore();

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

  // ── Pending FSRS cards per subject (real data from predictions engine) ──
  const pendingBySubject = useMemo(() => {
    const map = new Map<number, number>();
    if (!predictions?.cards) return map;
    for (const card of predictions.cards) {
      if (card.subjectId !== undefined) {
        map.set(card.subjectId, (map.get(card.subjectId) ?? 0) + 1);
      }
    }
    return map;
  }, [predictions]);

  // ── Next upcoming assessment per subject (real data from assessments) ──
  const nextMilestoneBySubject = useMemo(() => {
    const map = new Map<number, string>();
    const now = Date.now();
    const upcoming = assessments
      .filter(a => {
        const dateStr = a.due_date || a.grading_date;
        if (!dateStr || a.is_completed) return false;
        const ts = parseDateOrFail(dateStr);
        return !isNaN(ts) && ts > now;
      })
      .sort((a, b) => {
        const tA = parseDateOrFail((a.due_date || a.grading_date) ?? '');
        const tB = parseDateOrFail((b.due_date || b.grading_date) ?? '');
        return tA - tB;
      });
    for (const a of upcoming) {
      if (!map.has(a.subject_id)) {
        const dateStr = a.due_date || a.grading_date || '';
        const d = new Date(parseDateOrFail(dateStr));
        const label = `${a.name} (${d.toLocaleDateString('es', { month: 'short', day: 'numeric' })})`;
        map.set(a.subject_id, label);
      }
    }
    return map;
  }, [assessments]);

  const filteredSubjects = useMemo(() => {
    return subjects
      .filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
        (s.professor && s.professor.toLowerCase().includes(search.toLowerCase()))
      )
      .map(s => {
        const subjectAssessments = assessments.filter(a => a.subject_id === s.id);
        const projection = calculateProjection(subjectAssessments, s, null);
        return {
          ...s,
          avg_score: projection.currentAverage > 0 ? projection.currentAverage : s.avg_score,
          completion_percent: projection.evaluatedWeight > 0 ? projection.evaluatedWeight : s.completion_percent,
          pending_flashcards: pendingBySubject.get(s.id),
          next_milestone: nextMilestoneBySubject.get(s.id),
          delta: projection.delta,
        };
      });
  }, [subjects, search, pendingBySubject, nextMilestoneBySubject, assessments]);

  const localCriticalSubjects = useMemo(() => {
    return subjects
      .map(s => {
        const subjectAssessments = assessments.filter(a => a.subject_id === s.id);
        const projection = calculateProjection(subjectAssessments, s, null);
        const raw = projection.currentAverage > 0 ? projection.currentAverage : (s.avg_score ?? 0);
        const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
        return { ...s, computedAvg: avg, avg_score: raw };
      })
      .filter(s => s.computedAvg < 3.0)
      .sort((a, b) => a.computedAvg - b.computedAvg)
      .slice(0, 3);
  }, [subjects]);

  const localTotalCredits = useMemo(() => {
    return subjects.reduce((sum, s) => sum + (s.credits || 0), 0);
  }, [subjects]);

  const totalCredits = semesterSummary?.totalCredits ?? localTotalCredits;

  const criticalSubjects = useMemo(() => {
    if (semesterSummary?.criticalSubjects) {
      return semesterSummary.criticalSubjects.map(cs => ({
        id: cs.id,
        name: cs.name,
        avg_score: cs.avgScore,
        target_grade: cs.targetGrade,
        delta: cs.delta,
        color: cs.color,
        icon: cs.icon,
      }));
    }
    return localCriticalSubjects;
  }, [semesterSummary, localCriticalSubjects]);
  const recentActivity = useMemo(() => {
    const items: UnifiedActivityItem[] = [];
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    // 1. Assessments (pasado reciente)
    assessments.forEach(as => {
      const ts = parseDateOrFail(as.date || as.grading_date || as.due_date || '');
      if (ts > 0 && ts <= now && ts > now - SEVEN_DAYS_MS) {
        items.push({
          id: `asm-${as.id}`,
          title: as.name,
          subtitle: `Nota: ${as.score ?? 'Pendiente'} (${as.weight ?? 0}%)`,
          date: ts,
          subjectId: as.subject_id,
          type: 'assessment'
        });
      }
    });

    // 2. Flashcard Decks (repasados recientemente)
    flashcardDecks.forEach(deck => {
      // Usamos timestamp the última actualización si no hay last_reviewed_at
      const lastReviewed = deck.last_reviewed_at ? new Date(deck.last_reviewed_at).getTime() : 0;
      if (lastReviewed > now - SEVEN_DAYS_MS && lastReviewed <= now) {
        items.push({
          id: `fc-${deck.id}`,
          title: `Repaso: ${deck.title}`,
          subtitle: `${deck.review_count || 0} tarjetas memorizadas`,
          date: lastReviewed,
          subjectId: deck.subject_id || 0,
          type: 'flashcard'
        });
      }
    });

    // 3. UserStats (Sesiones de estudio)
    if (userStats?.recent_activity) {
      userStats.recent_activity.forEach((session: any, idx: number) => {
        const ts = new Date(session.review_date).getTime();
        if (ts > now - SEVEN_DAYS_MS && ts <= now) {
          const acc = session.total_attempts > 0 ? Math.round((session.correct_attempts / session.total_attempts) * 100) : 0;
          items.push({
            id: `study-${idx}-${ts}`,
            title: 'Sesión de Repaso',
            subtitle: `${session.total_attempts} tarjetas revisadas • ${acc}% de acierto`,
            date: ts,
            subjectId: 0,
            type: 'study'
          });
        }
      });
    }

    // 4. Calendar Events (pasado reciente)
    calendarEvents.forEach(ev => {
      const ts = parseDateOrFail(ev.startDate || '');
      if (ts > 0 && ts <= now && ts > now - SEVEN_DAYS_MS) {
        items.push({
          id: `cal-${ev.id}`,
          title: ev.title,
          subtitle: ev.eventType === 'class' ? 'Clase' : ev.eventType === 'exam' ? 'Examen' : 'Tarea',
          date: ts,
          subjectId: ev.subjectId || 0,
          type: 'calendar'
        });
      }
    });

    // Enriquecer con metadata de la materia y ordenar
    const sorted = items
      .map(item => {
        const subject = subjects.find(s => s.id === item.subjectId);
        return {
          ...item,
          subjectName: subject?.name || 'General',
          subjectColor: subject?.color || '#5856D6',
          relativeTime: getRelativeTime(item.date, t),
        };
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, 10); // Mostrar máximo los 10 eventos más recientes

    return sorted;
  }, [assessments, flashcardDecks, userStats, calendarEvents, subjects, t]);

  // ── Hero footer: motor de aprendizaje ──
  const dueDecksToday = useMemo(() => {
    // Mazos que tienen last_reviewed_at en algún momento y aún tienen cards pendientes (vía predictions)
    const dueIds = useDataStore.getState().getDuedeckIds();
    return dueIds.size;
  }, [predictions]);

  const studyStreak = useMemo(() => {
    if (!userStats?.study_streak) return 0;
    return userStats.study_streak as number;
  }, [userStats]);

  return {
    subjects, filteredSubjects, criticalSubjects,
    totalCredits, recentActivity,
    dueDecksToday, studyStreak,
    search, setSearch,
    overlayVisible, setOverlayVisible,
    overlayText, setOverlayText,
  };
}
