import { useState, useCallback, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDataStore } from '../store/useDataStore';
import { getSemesterSummary, SemesterSummary } from '../services/api/analytics';
import { SCALE_MAX } from '../utils/grades';
import { calculateProjection } from '../utils/projectionEngine';
import { studyNoteRepository } from '../services/database/repositories/StudyNoteRepository';
import { documentRepository } from '../services/database/repositories/DocumentRepository';
import { youTubeRepository } from '../services/database/repositories/YouTubeRepository';
import { audioRepository } from '../services/database/repositories/AudioRepository';
import { flashcardRepository } from '../services/database/repositories/FlashcardRepository';

export interface UnifiedActivityItem {
  id: string;
  title: string;
  subtitle: string;
  date: number;
  subjectId: string;
  subjectName?: string;
  subjectColor?: string;
  type: 'assessment' | 'deck' | 'flashcard' | 'study' | 'calendar' | 'subject' | 'course' | 'youtube' | 'recording' | 'note' | 'document';
  relativeTime?: string;
}

export const ACTIVITY_CONFIG: Record<UnifiedActivityItem['type'], { icon: string; color: string; label: string }> = {
  assessment: { icon: 'clipboard-outline',      color: '#3498db', label: 'Evaluación' },
  deck:       { icon: 'layers-outline',         color: '#e67e22', label: 'Mazo' },
  flashcard:  { icon: 'flash-outline',          color: '#f39c12', label: 'Carta' },
  study:      { icon: 'book-open-outline',      color: '#2ecc71', label: 'Sesión' },
  calendar:   { icon: 'calendar-outline',       color: '#9b59b6', label: 'Evento' },
  subject:    { icon: 'school-outline',         color: '#00b894', label: 'Materia' },
  course:     { icon: 'ribbon-outline',         color: '#0984e3', label: 'Curso' },
  youtube:    { icon: 'logo-youtube',           color: '#ff0000', label: 'Video' },
  recording:  { icon: 'mic-outline',            color: '#fd79a8', label: 'Grabación' },
  note:       { icon: 'document-text-outline',  color: '#6c5ce7', label: 'Apunte' },
  document:   { icon: 'scan-outline',           color: '#00cec9', label: 'Documento' },
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
  const now = new Date();
  const event = new Date(then);
  if (event > now) return t('subjects.timeJustNow');
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(event.getFullYear(), event.getMonth(), event.getDate());
  const diffDays = Math.floor((startOfToday.getTime() - startOfEvent.getTime()) / 86400000);
  if (diffDays === 0) {
    const diffMin = Math.floor((now.getTime() - then) / 60000);
    if (diffMin < 1) return t('subjects.timeJustNow');
    if (diffMin < 60) return t('subjects.timeMinutesAgo', { count: diffMin });
    const diffHrs = Math.floor(diffMin / 60);
    return t('subjects.timeHoursAgo', { count: diffHrs });
  }
  return t('subjects.timeDaysAgo', { count: diffDays });
}

export function useSubjects(t: any) {
  const { subjects, courses, assessments, loadAllData, predictions, calendarEvents, flashcardDecks, userStats } = useDataStore();

  const [search, setSearch] = useState('');
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [semesterSummary, setSemesterSummary] = useState<SemesterSummary | null>(null);
  const [extraItems, setExtraItems] = useState<{ notes: any[]; docs: any[]; videos: any[]; recordings: any[]; flashcards: any[] }>({ notes: [], docs: [], videos: [], recordings: [], flashcards: [] });

  useFocusEffect(
    useCallback(() => {
      InteractionManager.runAfterInteractions(async () => {
        loadAllData();
        getSemesterSummary()
          .then(setSemesterSummary)
          .catch(() => setSemesterSummary(null));
        try {
          const [notes, docs, videos, recordings, flashcards] = await Promise.all([
            studyNoteRepository.getAll().catch(() => []),
            documentRepository.getAll().catch(() => []),
            youTubeRepository.getAll().catch(() => []),
            audioRepository.getAll().catch(() => []),
            flashcardRepository.getAll().catch(() => []),
          ]);
          setExtraItems({ notes, docs, videos, recordings, flashcards });
        } catch {}
      });
    }, [loadAllData])
  );

  // ── Pending FSRS cards per subject (real data from predictions engine) ──
  const pendingBySubject = useMemo(() => {
    const map = new Map<string, number>();
    if (!predictions?.cards) return map;
    for (const card of predictions.cards) {
      if (card.subjectId !== undefined) {
        map.set(String(card.subjectId), (map.get(String(card.subjectId)) ?? 0) + 1);
      }
    }
    return map;
  }, [predictions]);

  // ── Next upcoming assessment per subject (real data from assessments) ──
  const nextMilestoneBySubject = useMemo(() => {
    const map = new Map<string, string>();
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

  const assessmentsBySubject = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of assessments) {
      if (!map.has(a.subject_id)) map.set(a.subject_id, []);
      map.get(a.subject_id)!.push(a);
    }
    return map;
  }, [assessments]);

  const projectionsBySubject = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of subjects) {
      const subjectAssessments = assessmentsBySubject.get(s.id) || [];
      const projection = calculateProjection(subjectAssessments, s, null);
      map.set(s.id, projection);
    }
    return map;
  }, [subjects, assessmentsBySubject]);

  const filteredSubjects = useMemo(() => {
    return subjects
      .filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
        (s.professor && s.professor.toLowerCase().includes(search.toLowerCase()))
      )
      .map(s => {
        const projection = projectionsBySubject.get(s.id)!;
        return {
          ...s,
          avg_score: projection.currentAverage > 0 ? projection.currentAverage : s.avg_score,
          completion_percent: projection.evaluatedWeight > 0 ? projection.evaluatedWeight : s.completion_percent,
          pending_flashcards: pendingBySubject.get(s.id),
          next_milestone: nextMilestoneBySubject.get(s.id),
          delta: projection.delta,
        };
      });
  }, [subjects, search, pendingBySubject, nextMilestoneBySubject, projectionsBySubject]);

  const localCriticalSubjects = useMemo(() => {
    return subjects
      .map(s => {
        const projection = projectionsBySubject.get(s.id)!;
        const raw = projection.currentAverage > 0 ? projection.currentAverage : (s.avg_score ?? 0);
        const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
        return { ...s, computedAvg: avg, avg_score: raw };
      })
      .filter(s => s.computedAvg > 0 && s.computedAvg < (s.target_grade || 3.0))
      .sort((a, b) => a.computedAvg - b.computedAvg)
      .slice(0, 3);
  }, [subjects, projectionsBySubject]);

  const localTotalCredits = useMemo(() => {
    return subjects.reduce((sum, s) => sum + (s.credits || 0), 0);
  }, [subjects]);

  const totalCredits = semesterSummary?.totalCredits ?? localTotalCredits;

  const criticalSubjects = useMemo(() => {
    return localCriticalSubjects.map(s => ({
      id: s.id,
      name: s.name,
      avg_score: s.computedAvg,
      target_grade: s.target_grade || 3.0,
      delta: (s.target_grade || 3.0) - s.computedAvg,
      color: s.color || '#4F46E5',
      icon: s.icon || 'book-outline',
    }));
  }, [localCriticalSubjects]);
  const recentActivity = useMemo(() => {
    const items: UnifiedActivityItem[] = [];
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = now - SEVEN_DAYS_MS;

    const inWindow = (ts: number) => ts > 0 && ts >= cutoff && ts <= now;

    // 1. Assessments (evaluaciones, exámenes, tareas, trabajos)
    assessments.forEach(as => {
      const ts = parseDateOrFail(as.date || as.grading_date || as.due_date || '');
      if (inWindow(ts)) {
        items.push({
          id: `asm-${as.id}`,
          title: as.name,
          subtitle: as.score != null ? `Nota: ${as.score} (${as.weight ?? 0}%)` : `Peso: ${as.weight ?? 0}%`,
          date: ts,
          subjectId: as.subject_id,
          type: 'assessment',
        });
      }
    });

    // 2. Subjects (creados recientemente)
    subjects.forEach(s => {
      const ts = parseDateOrFail(s.created_at || '');
      if (inWindow(ts)) {
        items.push({
          id: `sub-${s.id}`,
          title: s.name,
          subtitle: s.code || 'Materia',
          date: ts,
          subjectId: s.id,
          type: 'subject',
        });
      }
    });

    // 3. Courses (creados recientemente)
    courses.forEach(c => {
      const ts = parseDateOrFail(c.created_at || '');
      if (inWindow(ts)) {
        items.push({
          id: `crs-${c.id}`,
          title: c.name,
          subtitle: c.platform || 'Curso',
          date: ts,
          subjectId: '',
          type: 'course',
        });
      }
    });

    // 4. Flashcard Decks (creados + repasados)
    flashcardDecks.forEach(deck => {
      const createdTs = parseDateOrFail(deck.created_at || '');
      const reviewedTs = deck.last_reviewed_at ? new Date(deck.last_reviewed_at).getTime() : 0;
      if (inWindow(createdTs)) {
        items.push({
          id: `deck-${deck.id}`,
          title: deck.title,
          subtitle: `${deck.card_count ?? deck.review_count ?? 0} cartas`,
          date: createdTs,
          subjectId: deck.subject_id || '',
          type: 'deck',
        });
      }
      if (inWindow(reviewedTs) && reviewedTs !== createdTs) {
        items.push({
          id: `deck-rev-${deck.id}`,
          title: deck.title,
          subtitle: `Repasado • ${deck.review_count || 0} repasos`,
          date: reviewedTs,
          subjectId: deck.subject_id || '',
          type: 'deck',
        });
      }
    });

    // 5. Flashcards (cartas individuales agregadas/importadas)
    extraItems.flashcards.forEach(card => {
      const ts = parseDateOrFail(card.created_at || '');
      if (inWindow(ts)) {
        const front = (card.front || '').substring(0, 40);
        items.push({
          id: `card-${card.id}`,
          title: front ? `Carta: "${front}${front.length >= 40 ? '…' : ''}"` : 'Carta agregada',
          subtitle: 'Flashcard',
          date: ts,
          subjectId: '',
          type: 'flashcard',
        });
      }
    });

    // 6. YouTube Videos
    extraItems.videos.forEach(v => {
      const ts = parseDateOrFail(v.created_at || '');
      if (inWindow(ts)) {
        items.push({
          id: `yt-${v.id}`,
          title: v.title || 'Video de YouTube',
          subtitle: v.subject_name || 'YouTube',
          date: ts,
          subjectId: v.subject_id || '',
          type: 'youtube',
        });
      }
    });

    // 7. Audio Recordings
    extraItems.recordings.forEach(r => {
      const ts = parseDateOrFail(r.created_at || '');
      if (inWindow(ts)) {
        items.push({
          id: `rec-${r.id}`,
          title: r.name || 'Grabación de audio',
          subtitle: r.subject_name || 'Audio',
          date: ts,
          subjectId: r.subject_id || '',
          type: 'recording',
        });
      }
    });

    // 8. Study Notes (apuntes)
    extraItems.notes.forEach(n => {
      const ts = parseDateOrFail(n.created_at || '');
      if (inWindow(ts)) {
        items.push({
          id: `note-${n.id}`,
          title: n.title || 'Apunte',
          subtitle: n.source || 'Apunte',
          date: ts,
          subjectId: n.subject_id || '',
          type: 'note',
        });
      }
    });

    // 9. Scanned Documents
    extraItems.docs.forEach(d => {
      const ts = parseDateOrFail(d.created_at || '');
      if (inWindow(ts)) {
        items.push({
          id: `doc-${d.id}`,
          title: d.name || d.filename || 'Documento escaneado',
          subtitle: 'Documento',
          date: ts,
          subjectId: d.subject_id || '',
          type: 'document',
        });
      }
    });

    // 10. Calendar Events
    calendarEvents.forEach(ev => {
      const ts = parseDateOrFail(ev.startDate || '');
      if (inWindow(ts)) {
        items.push({
          id: `cal-${ev.id}`,
          title: ev.title,
          subtitle: ev.eventType === 'class' ? 'Clase' : ev.eventType === 'exam' ? 'Examen' : 'Evento',
          date: ts,
          subjectId: ev.subjectId || '',
          type: 'calendar',
        });
      }
    });

    // 11. UserStats (Sesiones de estudio)
    if (userStats?.recent_activity) {
      userStats.recent_activity.forEach((session: any, idx: number) => {
        const ts = new Date(session.review_date).getTime();
        if (inWindow(ts)) {
          const acc = session.total_attempts > 0 ? Math.round((session.correct_attempts / session.total_attempts) * 100) : 0;
          items.push({
            id: `study-${idx}-${ts}`,
            title: 'Sesión de Repaso',
            subtitle: `${session.total_attempts} tarjetas revisadas • ${acc}% de acierto`,
            date: ts,
            subjectId: '',
            type: 'study',
          });
        }
      });
    }

    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    // Enriquecer con metadata de la materia y ordenar
    const sorted = items
      .map(item => {
        const subject = subjectMap.get(item.subjectId);
        return {
          ...item,
          subjectName: subject?.name || 'General',
          subjectColor: subject?.color || '#5856D6',
          relativeTime: getRelativeTime(item.date, t),
        };
      })
      .sort((a, b) => b.date - a.date);

    return sorted;
  }, [assessments, flashcardDecks, userStats, calendarEvents, subjects, courses, extraItems, t]);

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
