import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDataStore } from '../store/useDataStore';
import { useSubjectGrades } from './useSubjectGrades';
import { getCurrentUserProfile } from '../services/api/auth';
import { downloadReport } from '../services/api/analytics';
import { normalizeGrade, parseWeight, SCALE_MAX } from '../utils/grades';
import { DEFAULT_GRADING_SYSTEMS, US_LETTER_SCALES } from '../services/api/gradingDefaults';
import { fetchSystemScales } from '../services/api/grading';
import { buildDisplayGrade, type DisplayGrade } from '../services/gradingEngineDisplay';
import { alertRef } from '../components/ui/CustomAlert';
import type { Course } from '../services/api/types';

export function useGrades(t: any) {
  const storeSubjects = useDataStore(s => s.subjects);
  const storeAssessments = useDataStore(s => s.assessments);
  const storeCourses = useDataStore(s => s.courses);
  const storeProfile = useDataStore(s => s.profile);
  const { refreshAssessments } = useDataStore();

  const subjects = storeSubjects;
  const assessments = storeAssessments;

  const [profile, setProfile] = useState<any>(storeProfile);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>(storeCourses);
  const [userId, setUserId] = useState<string | null>(storeProfile?.id != null ? String(storeProfile.id) : null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [simScore, setSimScore] = useState('');
  const [simPossible, setSimPossible] = useState('');
  const [projectedGpa, setProjectedGpa] = useState<string | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState('');

  const [activeSystem, setActiveSystem] = useState<any>(null);
  const [activeScales, setActiveScales] = useState<any[]>([]);

  const hadInitialDataRef = useRef(storeProfile !== null && storeCourses.length > 0);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
      if (!hadInitialDataRef.current) {
        getCurrentUserProfile().then(p => {
          setProfile(p);
          if (p?.id) setUserId(String(p.id));
        }).catch(() => {});
      }
      hadInitialDataRef.current = false;
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (storeProfile && !profile) {
      setProfile(storeProfile);
      if (storeProfile.id) setUserId(String(storeProfile.id));
    }
  }, [storeProfile]);

  useEffect(() => {
    if (storeCourses.length > 0 && courses.length === 0) {
      setCourses(storeCourses as Course[]);
    }
  }, [storeCourses]);

  useEffect(() => {
    if (!profile?.active_grading_version_id) return;
    const system = DEFAULT_GRADING_SYSTEMS.find(
      s => s.active_version_id === profile.active_grading_version_id
    );
    if (!system) return;
    setActiveSystem(system);
    if (system.code === 'US_LETTER') {
      setActiveScales(US_LETTER_SCALES);
    } else {
      fetchSystemScales(system.id)
        .then(data => { if (data?.scales?.length) setActiveScales(data.scales); })
        .catch(() => {});
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        refreshAssessments();
      });
      return () => task.cancel();
    }, [refreshAssessments])
  );

  const subjectsForCourse = useMemo(() =>
    selectedCourseId
      ? subjects.filter(s => (s as any).course_id === selectedCourseId)
      : subjects,
  [subjects, selectedCourseId]);

  const filteredAssessments = useMemo(() => {
    let base = assessments;
    if (selectedCourseId) {
      const ids = new Set(subjectsForCourse.map(s => s.id));
      base = base.filter(a => ids.has(a.subject_id));
    }
    if (selectedSubjectId === null) return base;
    return base.filter(a => a.subject_id === selectedSubjectId);
  }, [assessments, selectedSubjectId, selectedCourseId, subjectsForCourse]);

  const selectedSubject = useMemo(() =>
    subjects.find(s => s.id === selectedSubjectId) || null,
  [subjects, selectedSubjectId]);

  const {
    averageGrade,
    projectedGrade: engineProjectedGrade,
    delta: engineDelta,
  } = useSubjectGrades(filteredAssessments, selectedSubject, profile);

  const gradedAssessments = useMemo(() =>
    filteredAssessments.filter((a: any) => normalizeGrade(a) !== null),
  [filteredAssessments]);

  const evaluatedPercentage = useMemo(() => {
    return gradedAssessments.reduce((sum, a: any) => sum + (parseWeight(a) || 0), 0);
  }, [gradedAssessments]);

  const termGpa = averageGrade.toFixed(2);

  const displayGPA = termGpa;

  const displayProjectedGPA = engineProjectedGrade.toFixed(2);

  const displayDelta = engineDelta;

  const globalGpaLetter = useMemo<DisplayGrade | null>(() => {
    if (!activeSystem || !activeScales.length) return null;
    const gpaNum = parseFloat(displayGPA);
    if (isNaN(gpaNum) || gpaNum <= 0) return null;
    const normalized = gpaNum / SCALE_MAX;
    const rawValue = normalized * activeSystem.max_value;
    return buildDisplayGrade(rawValue, normalized, activeSystem, activeScales);
  }, [displayGPA, activeSystem, activeScales]);

  const globalProjectedLetter = useMemo<DisplayGrade | null>(() => {
    if (!activeSystem || !activeScales.length) return null;
    const gpaNum = parseFloat(displayProjectedGPA);
    if (isNaN(gpaNum) || gpaNum <= 0) return null;
    const normalized = gpaNum / SCALE_MAX;
    const rawValue = normalized * activeSystem.max_value;
    return buildDisplayGrade(rawValue, normalized, activeSystem, activeScales);
  }, [displayProjectedGPA, activeSystem, activeScales]);

  const handleRunSimulation = () => {
    const s = parseFloat(simScore);
    const w = parseFloat(simPossible);
    if (isNaN(s) || isNaN(w) || w === 0) {
      alertRef.show({
        title: t('common.error'),
        message: t('common.enterValidScorePossible', 'Ingresa una nota y un peso válido'),
        type: 'error',
      });
      return;
    }
    const currentGpaVal = parseFloat(displayGPA) || 0;
    const currentEvaluated = evaluatedPercentage;
    const simNormalized = s;
    if (currentEvaluated === 0) {
      setProjectedGpa(simNormalized.toFixed(2));
    } else {
      const currentPoints = currentGpaVal * (currentEvaluated / 100);
      const newPoints = currentPoints + (simNormalized * (w / 100));
      const newEvaluated = currentEvaluated + w;
      const newGpa = (newPoints / (newEvaluated / 100)).toFixed(2);
      setProjectedGpa(newGpa);
    }
  };

  const handleResetSim = () => {
    setSimScore('');
    setSimPossible('');
    setProjectedGpa(null);
  };

  const historicalGpas = useMemo(() => {
    const graded = [...gradedAssessments].sort((a: any, b: any) => {
      if (a.date && b.date) {
        try {
          const [da, ma, ya] = a.date.split('-');
          const [db, mb, yb] = b.date.split('-');
          return new Date(`${ya}-${ma}-${da}`).getTime() - new Date(`${yb}-${mb}-${db}`).getTime();
        } catch { return a.id - b.id; }
      }
      return a.id - b.id;
    });

    if (graded.length === 0) return [0, 0];

    let currentWeightedSum = 0;
    let currentTotalWeight = 0;
    const points: number[] = [];

    graded.forEach((curr) => {
      const val = normalizeGrade(curr) ?? 0;
      let w = parseWeight(curr);
      if (w <= 0) w = 1;
      currentWeightedSum += (val * w);
      currentTotalWeight += w;
      points.push(currentTotalWeight > 0 ? (currentWeightedSum / currentTotalWeight) : 0);
    });

    if (points.length === 1) return [0, points[0]];
    return points.slice(-10);
  }, [gradedAssessments]);

  const sanitize = (v: number) => isFinite(v) ? v : 0;

  const trendSeries = (projectedGpa
    ? [...historicalGpas, Number(projectedGpa)]
    : [...historicalGpas, parseFloat(displayProjectedGPA) || 0]
  ).map(sanitize);

  const handleDownloadReport = async () => {
    const uid = userId || (storeProfile?.id != null ? String(storeProfile.id) : null);
    if (!uid || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await downloadReport(uid);
    } catch (e: any) {
      alertRef.show({
        title: 'Error',
        message: e.message || 'No se pudo generar el informe',
        type: 'error',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const { availableCourseIds, availableSubjectIds } = useMemo(() => {
    const subjectIds = new Set<string>();
    const courseIds = new Set<string>();
    assessments.forEach((a: any) => {
      if (a.subject_id) {
        subjectIds.add(a.subject_id);
        const subj = subjects.find((s: any) => s.id === a.subject_id);
        if (subj && (subj as any).course_id) courseIds.add((subj as any).course_id);
      }
    });
    return { availableCourseIds: courseIds, availableSubjectIds: subjectIds };
  }, [assessments, subjects]);

  return {
    subjects, filteredAssessments, gradedAssessments,
    selectedSubjectId, setSelectedSubjectId,
    selectedCourseId, setSelectedCourseId,
    courses, subjectsForCourse,
    availableCourseIds, availableSubjectIds,
    userId,
    isReady,
    displayGPA, displayProjectedGPA, displayDelta, globalGpaLetter, globalProjectedLetter, activeSystem,
    termGpa, evaluatedPercentage, selectedSubject,
    simScore, setSimScore,
    simPossible, setSimPossible,
    projectedGpa,
    trendSeries, historicalGpas,
    overlayVisible, setOverlayVisible,
    overlayText, setOverlayText,
    isExportingPdf,
    handleRunSimulation, handleResetSim,
    handleDownloadReport,
  };
}
