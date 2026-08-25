import { RepositoryFactory } from '../../src/services/database/RepositoryFactory';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable, FlatList, RefreshControl } from 'react-native';
import LottieView from 'lottie-react-native';
import { alertRef } from '../../src/components/ui/CustomAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { dashboardStyles as styles } from '../../src/styles/Dashboard.styles';
import { getPredictedSubject, createStudySession, deleteSubject } from '../../src/services/api';
import type { UserProfile } from '../../src/services/api/types';
import type { Subject, Assessment, Schedule } from '../../src/services/database/repositories';
import { calculateProjection } from '../../src/utils/projectionEngine';
import { useDataStore } from '../../src/store/useDataStore';
import type { Course } from '../../src/services/api/types';
import { usePredictionPolling } from '../../src/hooks/usePredictionPolling';

import { downloadProfileImage, getLocalProfileImageUri } from '../../src/services/profileImageCache';
import { StudyTimerCard } from '../../src/components/timer/StudyTimerCard';
import { SnoozeModal } from '../../src/components/modals/SnoozeModal';
import { useDueCardSnooze, type SnoozeOption } from '../../src/hooks/useDueCardSnooze';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioRecorderModal } from '../../src/components/audio/AudioRecorderModal';
import { StudyTimerModal } from '../../src/components/timer/StudyTimerModal';
import { DocumentScannerModal } from '../../src/components/modals/DocumentScannerModal';
import { PhotoCaptureModal } from '../../src/components/modals/PhotoCaptureModal';
import { FlashcardsModal } from '../../src/components/flashcards/FlashcardsModal';
import { SubjectTile, ActionCircle } from '../../src/components/dashboard/DashboardWidgets';
import { UpNextCard } from '../../src/components/dashboard/UpNextCard';
import { KnowledgeHealthCard } from '../../src/components/dashboard/KnowledgeHealthCard';
import { DailyReviewCard } from '../../src/components/dashboard/DailyReviewCard';
import { useKnowledgeInsights } from '../../src/hooks/useKnowledgeInsights';
import { GroupPerformanceLeaderboard } from '../../src/components/dashboard/GroupPerformanceLeaderboard';
import { CourseHeroCard, AllSubjectsHeroCard, HERO_CARD_WIDTH } from '../../src/components/dashboard/CourseHeroCard';
import { CreateSubjectModal } from '../../src/components/dashboard/CreateSubjectModal';
import { CreateCourseModal } from '../../src/components/dashboard/CreateCourseModal';
import { EditSubjectModal } from '../../src/components/dashboard/EditSubjectModal';
import { CreateGradeModal } from '../../src/components/dashboard/CreateGradeModal';
import { CreateTaskModal } from '../../src/components/dashboard/CreateTaskModal';
import { SchedulePlannerModal } from '../../src/components/dashboard/SchedulePlannerModal';
import { OfflineIndicator } from '../../src/components/ui/OfflineIndicator';
import { GlobalHeroPresenter } from '../../src/presentation/heroes/GlobalHeroPresenter';
import { CourseHeroPresenter } from '../../src/presentation/heroes/CourseHeroPresenter';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';
import { DashboardCoordinator } from '../../src/dashboard/DashboardCoordinator';
import { buildDashboardTasks } from '../../src/dashboard/DashboardTasks';
import { dashboardTelemetry } from '../../src/performance/DashboardTelemetry';



const SUBJECT_LOOP_THRESHOLD = 4;
const SUBJECT_LOOP_MULTIPLIER = 16;
const SUBJECT_CARD_WIDTH = 144;
const SUBJECT_CARD_GAP = 10;


export default function HybridDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // ── Selectores individuales del store para minimizar re-renders ──
  const subjects = useDataStore(s => s.subjects);
  const assessments = useDataStore(s => s.assessments);
  const storeSchedules = useDataStore(s => s.schedules);
  const predictions = useDataStore(s => s.predictions);
  const courses = useDataStore(s => s.courses);
  const storeProfile = useDataStore(s => s.profile);
  const storeGroups = useDataStore(s => s.userGroups);
  const storeOverallGpa = useDataStore(s => s.overallGpa);
  const isSyncing = useDataStore(s => s.isSyncing);
  const syncStatusMessage = useDataStore(s => s.syncStatusMessage);
  const loadAllData = useDataStore(s => s.loadAllData);
  const refreshPredictions = useDataStore(s => s.refreshPredictions);
  const refreshProfile = useDataStore(s => s.refreshProfile);
  const refreshUserGroups = useDataStore(s => s.refreshUserGroups);
  const refreshOverallGpa = useDataStore(s => s.refreshOverallGpa);
  const syncTodaySchedules = useDataStore(s => s.syncTodaySchedules);
  const predictionsSource = useDataStore(s => s.predictionsSource);
  const [localProfileImageUri, setLocalProfileImageUri] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const localUri = await getLocalProfileImageUri();
      if (localUri) setLocalProfileImageUri(localUri);
    })();
  }, []);

  // Red pura — no tocan SQLite, no causan contención en el bridge
  useEffect(() => {
    refreshProfile();
    refreshUserGroups();
  }, []);

  // coreReady: señal para PredictionPolling (inteligencia secundaria).
  // El ~500ms de React scheduler es aceptable aquí.
  const [coreReady, setCoreReady] = useState(false);

  // Cargas SQLite coordinadas: Schedule (P1) → GPA (P2), ejecución secuencial.
  // Knowledge Snapshot es autónomo (useKnowledgeInsights lo maneja al mount).
  useEffect(() => {
    dashboardTelemetry.mount();
    dashboardTelemetry.log('useEffect[coordinator] fired — Dashboard component mount');
    const coordinator = new DashboardCoordinator(
      buildDashboardTasks({ syncTodaySchedules, refreshOverallGpa })
    );
    coordinator.start().then(() => {
      dashboardTelemetry.log('coordinator.then() — all tasks done');
      setCoreReady(true);
      dashboardTelemetry.log('Post-coordinator: all done');
      dashboardTelemetry.report();
    });
    return () => {
      dashboardTelemetry.log('coordinator cancelled');
      coordinator.cancel();
    };
  }, []);


  const [isSubjectModalVisible, setIsSubjectModalVisible] = useState(false);
  const [isCourseModalVisible, setIsCourseModalVisible] = useState(false);
  const [isCreationMenuVisible, setIsCreationMenuVisible] = useState(false);
  const [isEditSubjectModalVisible, setIsEditSubjectModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const subjectsCarouselRef = useRef<FlatList<any> | null>(null);
  
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayText, setOverlayText] = useState<string | null>(null);
  
  const [selectedDashboardCourseId, setSelectedDashboardCourseId] = useState<string | null>(null); // null = "todas"
  const heroCarouselRef = useRef<FlatList<any> | null>(null);

  // Quick Add Menu states
  const [isQuickAddMenuVisible, setIsQuickAddMenuVisible] = useState(false);
  const [isGradeModalVisible, setIsGradeModalVisible] = useState(false);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [predictedSubjectId, setPredictedSubjectId] = useState<string | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);

  const profile = storeProfile;
  const overallGpa = storeOverallGpa;
  const userGroups = storeGroups;

  // ── allSchedules viene del store ahora ─────────────────────────────────
  const allSchedules = storeSchedules;

  // States
  const [isAudioModalVisible, setIsAudioModalVisible] = useState(false);
  const [isTimerModalVisible, setIsTimerModalVisible] = useState(false);
  const [timerViewState, setTimerViewState] = useState<'config' | 'feedback'>('config');
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [isFlashcardsVisible, setIsFlashcardsVisible] = useState(false);
  const [timerRefreshTrigger, setTimerRefreshTrigger] = useState(0);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  
  // Timer Session State
  const [lastSessionDuration, setLastSessionDuration] = useState<number>(0);
  const [lastSessionSubjectId, setLastSessionSubjectId] = useState<string | null>(null);
  const [lastSessionMode, setLastSessionMode] = useState<'pomodoro' | 'threshold'>('pomodoro');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFocusRefreshRef = useRef<number>(0);
  const FOCUS_REFRESH_THROTTLE_MS = 5 * 60 * 1000; // 5 min

  // ── Tiempo reactivo para el countdown del Dashboard ─────────────────────
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTimestamp(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Snooze State
  const snoozeManager = useDueCardSnooze();
  const [isSnoozeModalVisible, setIsSnoozeModalVisible] = useState(false);
  const [snoozeRefreshTrigger, setSnoozeRefreshTrigger] = useState(0); // Trigger para re-render cuando cambia snooze

  // Escuchar cambios en snoozedCards y actualizar trigger
  useEffect(() => {
    setSnoozeRefreshTrigger(prev => prev + 1);
  }, [snoozeManager.snoozedCards]);

  const loadData = useCallback(async (skipFullReload = false) => {
    try {
      const now = Date.now();
      if (!skipFullReload && (now - lastFocusRefreshRef.current > FOCUS_REFRESH_THROTTLE_MS)) {
        lastFocusRefreshRef.current = now;
        await loadAllData(true);
      }
    } catch (err) {
      console.warn('Error loading dashboard data:', err);
    }
  }, [loadAllData, FOCUS_REFRESH_THROTTLE_MS]);

  // Handle pull-to-refresh: actualizar datos y predicciones
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    lastFocusRefreshRef.current = 0;
    try {
      await Promise.all([
        loadData(),
        profile?.id ? refreshPredictions(profile.id) : Promise.resolve(),
        refreshOverallGpa(),
        refreshUserGroups(),
        refreshProfile(),
      ]);
    } catch (err) {
      console.warn('Error refreshing dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, profile?.id, refreshPredictions, refreshOverallGpa, refreshUserGroups, refreshProfile]);

  const handleEditSubject = useCallback((subject: Subject) => {
    setEditingSubject(subject);
    setIsEditSubjectModalVisible(true);
  }, []);

  const handleDeleteSubject = useCallback((subject: Subject) => {
    alertRef.show({
      title: t('subjects.deleteSubjectTitle'),
      message: t('subjects.deleteSubjectConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' as const },
        {
          text: t('common.delete') || 'Eliminar',
          style: 'destructive' as const,
          onPress: async () => {
            try {
              await deleteSubject(subject.id);
              await loadAllData(true);
              alertRef.show({ title: t('subjects.deleteSubjectTitle'), message: t('subjects.deleteSubjectSuccess'), type: 'info' });
            } catch {
              alertRef.show({ title: t('subjects.error') || 'Error', message: t('subjects.deleteSubjectError'), type: 'error' });
            }
          },
        },
      ],
    });
  }, [t, loadAllData]);

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const handleEditCourse = useCallback((course: Course) => {
    setEditingCourse(course);
    setIsCourseModalVisible(true);
  }, []);

  const handleDeleteCourse = useCallback((course: Course) => {
    alertRef.show({
      title: 'Eliminar Curso',
      message: `¿Estás seguro de que deseas eliminar el curso "${course.name}"? Las materias asociadas quedarán "Sin Asignar".`,
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' as const },
        {
          text: 'Eliminar',
          style: 'destructive' as const,
          onPress: async () => {
            try {
              const { deleteCourse } = await import('../../src/services/api/courses');
              await deleteCourse(course.id);
              setSelectedDashboardCourseId(null);
              heroCarouselRef.current?.scrollToOffset({ offset: 0, animated: true });
              await loadData(true);
              alertRef.show({ title: 'Curso eliminado', message: 'El curso se ha eliminado con éxito.', type: 'success' });
            } catch {
              alertRef.show({ title: 'Error', message: 'No se pudo eliminar el curso.', type: 'error' });
            }
          },
        },
      ],
    });
  }, [loadData]);

  useFocusEffect(
    React.useCallback(() => {
      // Skip full reload on focus — useProgressiveDataLoading in tab layout
      // handles data loading. Only update derived state (schedules, profile).
      loadData(true);
    }, [loadData])
  );

  // ── Polling de predicciones: P1, espera coreReady (Schedule+GPA done) ───
  usePredictionPolling(profile?.id, true, coreReady);

  // ── KnowledgeSnapshot: autónomo, se dispara al mount (useKnowledgeInsights) ──
  const { snapshot: knowledgeSnapshot, loading: knowledgeLoading } = useKnowledgeInsights(profile?.id);

  const fullName = useMemo(() => {
    const first = profile?.name?.trim() || '';
    const last = profile?.lastname?.trim() || '';
    return `${first} ${last}`.trim();
  }, [profile]);

  const nickname = useMemo(() => {
    const finalNickname = profile?.username?.trim() || fullName || '';
    return finalNickname;
  }, [fullName, profile]);

  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { 
        text: t('dashboard.greetings.morning'), 
        animation: require('../../src/lottieFiles/morning.json') 
      };
    } else if (hour >= 12 && hour < 18) {
      return { 
        text: t('dashboard.greetings.afternoon'), 
        animation: require('../../src/lottieFiles/evening.json') 
      };
    } else {
      return { 
        text: t('dashboard.greetings.evening'), 
        animation: require('../../src/lottieFiles/night.json') 
      };
    }
  }, [t]);

  const profileSubtitle = useMemo(() => {
    const nameTag = nickname || t('dashboard.you');
    const gpaStr = overallGpa != null ? overallGpa.toFixed(2) : '—';
    return t('dashboard.gpaSummary', { gpa: gpaStr, name: nameTag });
  }, [nickname, t, overallGpa]);

  const profileAvatarUri = localProfileImageUri || profile?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname || t('dashboard.defaultUser'))}&background=EDEEF2&color=111111&bold=true`;

  const shouldUseInfiniteCarousel = subjects.length > SUBJECT_LOOP_THRESHOLD;

  const enrichedSubjects = useMemo(() => {
    return subjects.map((s) => {
      const subjectAssessments = assessments.filter((a: Assessment) => a.subject_id === s.id);
      const projection = calculateProjection(subjectAssessments, s, null);
      return {
        ...s,
        avg_score: projection.currentAverage > 0 ? projection.currentAverage : s.avg_score,
        completion_percent: projection.evaluatedWeight > 0 ? projection.evaluatedWeight : s.completion_percent,
      };
    });
  }, [subjects, assessments]);

  const filteredEnrichedSubjects = useMemo(() => {
    if (selectedDashboardCourseId === 'independent') {
      return enrichedSubjects.filter(s => !s.course_id);
    }
    if (selectedDashboardCourseId) {
      return enrichedSubjects.filter(s => s.course_id === selectedDashboardCourseId);
    }
    return enrichedSubjects; // 'all'
  }, [enrichedSubjects, selectedDashboardCourseId]);

  const selectedCourse = useMemo(() => {
    if (!selectedDashboardCourseId || selectedDashboardCourseId === 'independent') return null;
    return courses.find(c => c.id === selectedDashboardCourseId) ?? null;
  }, [selectedDashboardCourseId, courses]);

  const isFlatCourse = useMemo(() => {
    if (!selectedCourse) return false;
    return filteredEnrichedSubjects.length === 0 || (selectedCourse.total_classes ?? 0) > 0;
  }, [selectedCourse, filteredEnrichedSubjects]);

  const handleIncrementClass = useCallback(async () => {
    if (!selectedCourse) return;
    try {
      await RepositoryFactory.courses().incrementClass(selectedCourse.id);
      const updated = await RepositoryFactory.courses().getById(selectedCourse.id);
      if (updated) {
        useDataStore.setState(state => ({
          courses: state.courses.map(c => c.id === updated.id ? updated as any : c)
        }));
      }
    } catch (err) {
      console.error('[Dashboard] Error incrementando clase:', err);
    }
  }, [selectedCourse]);

  const handleDecrementClass = useCallback(async () => {
    if (!selectedCourse) return;
    try {
      await RepositoryFactory.courses().decrementClass(selectedCourse.id);
      const updated = await RepositoryFactory.courses().getById(selectedCourse.id);
      if (updated) {
        useDataStore.setState(state => ({
          courses: state.courses.map(c => c.id === updated.id ? updated as any : c)
        }));
      }
    } catch (err) {
      console.error('[Dashboard] Error decrementando clase:', err);
    }
  }, [selectedCourse]);

  const carouselSubjects = useMemo(() => {
    if (!filteredEnrichedSubjects.length) return [] as (Subject & { __key: string })[];
    const base = filteredEnrichedSubjects;
    if (base.length <= SUBJECT_LOOP_THRESHOLD) {
      return base.map(subject => ({ ...subject, __key: subject.id }));
    }
    const result: (Subject & { __key: string })[] = [];
    for (let loop = 0; loop < SUBJECT_LOOP_MULTIPLIER; loop++) {
      for (const subject of base) {
        result.push({ ...subject, __key: `${subject.id}-${loop}` });
      }
    }
    return result;
  }, [filteredEnrichedSubjects]);

  // Items para el hero carousel: tarjeta "Todas" + un card por curso + "Independientes" si hay
  const heroCourseItems = useMemo(() => {
    const items: Array<{ type: 'all' } | { type: 'course'; course: Course } | { type: 'independent' }> = [
      { type: 'all' },
      ...courses.map(c => ({ type: 'course' as const, course: c })),
    ];
    const hasIndependent = enrichedSubjects.some(s => !s.course_id);
    if (hasIndependent) items.push({ type: 'independent' });
    return items;
  }, [courses, enrichedSubjects]);

  const handleHeroCardSelect = useCallback((courseId: string | null) => {
    setSelectedDashboardCourseId(courseId);
    subjectsCarouselRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const globalHeroPresenter = useMemo(() => new GlobalHeroPresenter(), []);
  const courseHeroPresenter = useMemo(() => new CourseHeroPresenter(), []);

  // C2: ViewModels precalculados — presenter.build() nunca corre dentro de renderItem
  const heroItemsWithVMs = useMemo(() => {
    const independentCourse = { id: 'independent', user_id: '', name: 'Materias Independientes' } as Course;
    return heroCourseItems.map(item => {
      if (item.type === 'all') {
        return {
          ...item,
          vm: globalHeroPresenter.build({
            subjects: enrichedSubjects,
            courses,
            assessments,
            healthScore: knowledgeSnapshot?.health.score,
          }),
        };
      }
      if (item.type === 'independent') {
        const independentSubjects = enrichedSubjects.filter(s => !s.course_id);
        const primaryKnowledge = knowledgeSnapshot?.subjects
          ?.filter(s => independentSubjects.some(is_ => is_.id === s.subjectId))
          .sort((a, b) => a.retrievability - b.retrievability)[0];
        return {
          ...item,
          vm: courseHeroPresenter.build({
            course: independentCourse,
            subjects: independentSubjects,
            primaryKnowledge: primaryKnowledge ? {
              subjectId: primaryKnowledge.subjectId,
              subjectName: primaryKnowledge.subjectName,
              score: Math.round(primaryKnowledge.retrievability),
              memoryLevel: primaryKnowledge.memoryLevel,
              retrievability: primaryKnowledge.retrievability,
            } : undefined,
          }),
        };
      }
      // type === 'course'
      const courseSubjects = enrichedSubjects.filter(s => s.course_id === item.course.id);
      const primaryKnowledge = knowledgeSnapshot?.subjects
        ?.filter(s => courseSubjects.some(cs => cs.id === s.subjectId))
        .sort((a, b) => a.retrievability - b.retrievability)[0];
      return {
        ...item,
        vm: courseHeroPresenter.build({
          course: item.course,
          subjects: courseSubjects,
          primaryKnowledge: primaryKnowledge ? {
            subjectId: primaryKnowledge.subjectId,
            subjectName: primaryKnowledge.subjectName,
            score: Math.round(primaryKnowledge.retrievability),
            memoryLevel: primaryKnowledge.memoryLevel,
            retrievability: primaryKnowledge.retrievability,
          } : undefined,
        }),
      };
    });
  }, [heroCourseItems, enrichedSubjects, courses, assessments, knowledgeSnapshot, globalHeroPresenter, courseHeroPresenter]);

  const initialScrollIndex = useMemo(() => {
    if (!shouldUseInfiniteCarousel || !subjects.length) return 0;
    return Math.floor(SUBJECT_LOOP_MULTIPLIER / 2) * subjects.length;
  }, [subjects.length, shouldUseInfiniteCarousel]);

  const normalizeCarouselPosition = (xOffset: number) => {
    if (!shouldUseInfiniteCarousel || !subjectsCarouselRef.current || !subjects.length) return;

    const itemSpan = SUBJECT_CARD_WIDTH + SUBJECT_CARD_GAP;
    const rawIndex = Math.round(xOffset / itemSpan);
    const lowerBoundary = subjects.length * 2;
    const upperBoundary = subjects.length * (SUBJECT_LOOP_MULTIPLIER - 2);

    if (rawIndex <= lowerBoundary || rawIndex >= upperBoundary) {
      const normalizedIndex = ((rawIndex % subjects.length) + subjects.length) % subjects.length;
      const targetIndex = initialScrollIndex + normalizedIndex;
      requestAnimationFrame(() => {
        subjectsCarouselRef.current?.scrollToIndex({ index: targetIndex, animated: false });
      });
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };



  const handleKnowledgeInfoPress = useCallback(() => {
    setOverlayText(
`### Entendiendo tu Estado de Aprendizaje

Estas métricas te ayudan a separar lo que **realmente recuerdas** de qué tan **precisa** es la información que te mostramos.

**Confianza**
No mide tu memoria, mide **qué tantos datos tiene la IA para entender cómo aprendes**. Solo depende de cuántas tarjetas has creado. Al superar las 500 tarjetas en tu cuenta, las predicciones alcanzan su máxima precisión (96%).

**Consolidado**
Es el conocimiento que ya es tuyo a largo plazo. Es el porcentaje de información que has repasado tantas veces que ha alcanzado la **Maestría**. Tu cerebro tardará semanas o incluso meses en olvidar estos conceptos.

**Riesgo Hoy**
Te avisa qué tan cerca estás de olvidar lo que ya aprendiste. Muestra el porcentaje de conocimiento en riesgo crítico (memorización por debajo del 70%). Si no repasas estas materias hoy, el esfuerzo que invertiste en aprenderlas podría perderse.`
    );
    setOverlayVisible(true);
  }, []);

  const handleOpenQuickAdd = async () => {
    setIsQuickAddMenuVisible(true);
    try {
      const predicted = await getPredictedSubject();
      if (predicted) {
        setPredictedSubjectId(predicted.id);
      } else {
        setPredictedSubjectId(null);
      }
    } catch (e) {
      console.warn('Prediction error:', e);
    }
  };

  const handleSnoozeSelection = async (option: SnoozeOption) => {
    try {
      // Usar un ID único para la alerta de "Repasos Urgentes"
      const alertId = 'due_cards_alert';
      await snoozeManager.snoozeCard(alertId, option.minutes);
      
      // Fuerza un re-render inmediato del dashboard
      setSnoozeRefreshTrigger(prev => prev + 1);
      
      setIsSnoozeModalVisible(false);
      
      // Mostrar confirmación
      alertRef.show({
        title: 'Aplazado',
        message: `Revisaremos en ${option.label.toLowerCase()}`,
        type: 'success',
        buttons: [{ text: 'Aceptar', style: 'default' }],
      });
    } catch (error) {
      console.error('Error snoozing alert:', error);
      alertRef.show({
        title: 'Error',
        message: t('common.errors.snoozeFailed'),
        type: 'error',
        buttons: [{ text: 'Aceptar', style: 'default' }],
      });
    }
  };

  const handleTakePhoto = () => {
    setIsQuickAddMenuVisible(false);
    setIsPhotoModalVisible(true);
  };



  const subjectNamesMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of subjects) {
      map[String(s.id)] = s.name;
    }
    return map;
  }, [subjects]);

  // ── "Lo siguiente": estado de próxima clase (hoy / mañana) ─────────────
  const upNextClass = useMemo(() => {
    const now = new Date(nowTimestamp);
    const todayDow = now.getDay();
    const tomorrowDow = (todayDow + 1) % 7;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const todayScheds = (storeSchedules as Schedule[]).filter((s) => s.day_of_week === todayDow);
    const tomorrowScheds = (storeSchedules as Schedule[])
      .filter((s) => s.day_of_week === tomorrowDow)
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));

    const subjectName = (s: Schedule) =>
      (s.subject_id && subjectNamesMap[s.subject_id]) || s.name || t('dashboard.unknownSubject', { defaultValue: 'Materia' });
    const formatRange = (s: Schedule) => `${s.start_time || ''} - ${s.end_time || ''}`;

    const timeUntil = (startTime: string) => {
      const [h, m] = startTime.split(':').map(Number);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
      const diffMins = Math.round((start.getTime() - now.getTime()) / 60000);
      if (diffMins <= 0) return t('dashboard.inSession', { defaultValue: 'En este momento' });
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hours > 0) {
        return mins > 0
          ? t('dashboard.inHoursMin', { hours, mins, defaultValue: `Dentro de ${hours}h ${mins}m` })
          : t('dashboard.inHours', { hours, defaultValue: `Dentro de ${hours}h` });
      }
      return t('dashboard.inMinutes', { mins, defaultValue: `Dentro de ${mins} min` });
    };

    const todayNext = todayScheds.find((s) => (s.end_time ?? '') >= currentTime);

    if (todayNext) {
      const live = (todayNext.start_time ?? '') <= currentTime;
      return {
        context: live ? t('dashboard.inSession', { defaultValue: 'En este momento' }) : timeUntil(todayNext.start_time || ''),
        value: subjectName(todayNext),
        footer: formatRange(todayNext),
        live,
        subjectId: todayNext.subject_id,
      };
    }

    if (tomorrowScheds.length > 0) {
      const next = tomorrowScheds[0];
      return {
        context: todayScheds.length > 0
          ? t('dashboard.untilTomorrow', { defaultValue: 'Hasta mañana' })
          : t('dashboard.tomorrow'),
        value: subjectName(next),
        footer: formatRange(next),
        live: false,
        subjectId: next.subject_id,
      };
    }

    return {
      context: t('dashboard.today', { defaultValue: 'Hoy' }),
      value: t('dashboard.noClasses'),
      footer: t('dashboard.enjoyDay'),
      live: false,
      subjectId: undefined,
    };
  }, [storeSchedules, subjectNamesMap, t, nowTimestamp]);

  // ── "Lo siguiente": próxima tarea (hoy / mañana) ───────────────────────
  const upNextTask = useMemo(() => {
    const fmt = (d: Date) =>
      `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
    const todayStr = fmt(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = fmt(tomorrow);

    const byName = (a: Assessment, b: Assessment) => (a.name || '').localeCompare(b.name || '');
    const todayPending = (assessments as Assessment[])
      .filter((a) => a.date === todayStr && !a.is_completed)
      .sort(byName);
    const tomorrowPending = (assessments as Assessment[])
      .filter((a) => a.date === tomorrowStr && !a.is_completed)
      .sort(byName);

    let target: Assessment | null = null;
    let horizon: 'today' | 'tomorrow' | null = null;
    if (todayPending.length > 0) {
      target = todayPending[0];
      horizon = 'today';
    } else if (tomorrowPending.length > 0) {
      target = tomorrowPending[0];
      horizon = 'tomorrow';
    }

    if (!target || !horizon) {
      return {
        context: t('dashboard.today', { defaultValue: 'Hoy' }),
        value: t('dashboard.nothingPending'),
        footer: t('dashboard.takeABreak'),
        color: '#5856D6',
      };
    }

    const count = horizon === 'today' ? todayPending.length : tomorrowPending.length;
    const context = horizon === 'today'
      ? (count === 1 ? t('dashboard.pendingTodayOne') : t('dashboard.pendingToday', { count }))
      : (count === 1 ? t('dashboard.pendingTomorrowOne') : t('dashboard.pendingTomorrow', { count }));

    const subject = target.subject_id ? subjects.find((s) => s.id === target.subject_id) : undefined;
    const parts: string[] = [];
    if (subject?.name) parts.push(subject.name);
    const avg = subject?.avg_score ?? subject?.normalized_avg_score;
    if (avg != null && !Number.isNaN(Number(avg))) parts.push(Number(avg).toFixed(1));
    if (subject?.completion_percent != null) parts.push(`${Math.round(subject.completion_percent)}%`);
    const footer = parts.join(' · ') || t('dashboard.takeABreak');

    let color = '#34C759';
    try {
      const [d, m, y] = (target.date || '').split('-').map(Number);
      if (!d || !m || !y) throw new Error('invalid date');
      const due = new Date(y, m - 1, d);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((due.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) color = '#FF3B30';
      else if (diffDays <= 3) color = '#FF9500';
    } catch {
      color = '#5856D6';
    }

    return { context, value: target.name, footer, color };
  }, [assessments, subjects, t]);

  return (
    <>
      <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        
        {/* 1. HEADER */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.greetingText, { flexShrink: 1 }]}>
                  {greetingData.text}{nickname ? `, ${nickname}` : ''}
                </Text>
                <LottieView
                  source={greetingData.animation}
                  autoPlay
                  loop
                  style={{ width: 44, height: 44, marginLeft: 2 }}
                />
              </View>
              <Text style={styles.greetingSubtext}>{profileSubtitle}</Text>
              <View style={{ marginTop: 6 }}><OfflineIndicator /></View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.openSettings')}
            >
              <View style={styles.avatarBadgeWrapper}>
                <Image 
                  source={{ uri: profileAvatarUri }} 
                  style={styles.avatar} 
                />
                <View style={styles.settingsBadge}>
                  <Ionicons name="settings" size={15} color={theme.colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* SYNC INDICATOR */}
        {isSyncing ? (
          <View style={styles.syncIndicator}>
            <View style={styles.syncIndicatorDot} />
            <Text style={styles.syncIndicatorText}>{t('dashboard.syncing', { defaultValue: syncStatusMessage || 'Sincronizando...' })}</Text>
          </View>
        ) : null}


        {/* ====================================================== */}
        {/* CURSOS Y MATERIAS                                    */}
        {/* ====================================================== */}
        {/* 2. COURSE HERO + YOUR SUBJECTS */}
        <View style={styles.section}>
          {/* Section header */}
          <View style={styles.subjectsHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Tus cursos</Text>
            <TouchableOpacity style={styles.subjectsAddBtn} onPress={() => setIsCreationMenuVisible(true)}>
              <Ionicons name="add" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          {/* Empty state: no courses */}
          {courses.length === 0 && enrichedSubjects.length === 0 ? (
            <View style={styles.emptyCourseCard}>
              <Ionicons name="school" size={40} color={theme.colors.primary} />
              <Text style={styles.emptyCourseTitle}>Aún no tienes cursos</Text>
              <Text style={styles.emptyCourseSubtext}>Crea un curso o semestre para organizar tus materias y evaluar tu rendimiento académico.</Text>
              <TouchableOpacity style={styles.emptyCourseBtn} onPress={() => setIsCourseModalVisible(true)}>
                <Ionicons name="add" size={18} color={theme.colors.white} />
                <Text style={styles.emptyCourseBtnText}>Crear mi primer curso</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Hero Carousel — one card per course, paginated */}
          {courses.length > 0 && (
            <>
              {/* marginHorizontal: -24 neutraliza el paddingHorizontal del ScrollView padre */}
              <View style={{ marginHorizontal: -24 }}>
              <FlatList
                ref={heroCarouselRef}
                horizontal
                data={heroCourseItems}
                keyExtractor={(item, idx) => item.type === 'course' ? item.course.id : `${item.type}-${idx}`}
                showsHorizontalScrollIndicator={false}
                snapToInterval={HERO_CARD_WIDTH + 16}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 24 }}
                ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (HERO_CARD_WIDTH + 16));
                  const item = heroCourseItems[idx];
                  if (!item) return;
                  if (item.type === 'all') handleHeroCardSelect(null);
                  else if (item.type === 'independent') handleHeroCardSelect('independent');
                  else handleHeroCardSelect(item.course.id);
                }}
                renderItem={({ item }) => {
                  const itemWithVM = heroItemsWithVMs.find(i => {
                    if (i.type !== item.type) return false;
                    if (i.type === 'course' && item.type === 'course') return i.course.id === item.course.id;
                    return true;
                  });
                  if (!itemWithVM) return null;

                  if (itemWithVM.type === 'all') {
                    return (
                      <AllSubjectsHeroCard
                        viewModel={itemWithVM.vm}
                        isActive={selectedDashboardCourseId === null}
                        onPress={() => handleHeroCardSelect(null)}
                      />
                    );
                  }
                  if (itemWithVM.type === 'independent') {
                    return (
                      <CourseHeroCard
                        viewModel={itemWithVM.vm}
                        isActive={selectedDashboardCourseId === 'independent'}
                        onPress={() => handleHeroCardSelect('independent')}
                        onContinue={() => {
                          const subjectId = itemWithVM.vm.continueTarget?.subjectId;
                          if (subjectId) {
                            router.push(`/subjects/${subjectId}`);
                          } else {
                            handleHeroCardSelect('independent');
                          }
                        }}
                      />
                    );
                  }
                  // type === 'course'
                  return (
                    <CourseHeroCard
                      viewModel={itemWithVM.vm}
                      isActive={selectedDashboardCourseId === itemWithVM.course.id}
                      onPress={() => handleHeroCardSelect(itemWithVM.course.id)}
                      onContinue={() => {
                        const subjectId = itemWithVM.vm.continueTarget?.subjectId;
                        if (subjectId) {
                          router.push(`/subjects/${subjectId}`);
                        } else {
                          handleHeroCardSelect(itemWithVM.course.id);
                        }
                      }}
                      onEditPress={() => handleEditCourse(itemWithVM.course)}
                      onDeletePress={() => handleDeleteCourse(itemWithVM.course)}
                    />
                  );
                }}
              />
              </View>

              {/* Pagination dots */}
              {heroCourseItems.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                  {heroCourseItems.map((item, idx) => {
                    const itemCourseId = item.type === 'course' ? item.course.id : item.type === 'independent' ? 'independent' : null;
                    const isActive = itemCourseId === selectedDashboardCourseId;
                    return (
                      <View
                        key={idx}
                        style={{
                          width: isActive ? 18 : 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: isActive ? theme.colors.primary : theme.colors.border,
                        }}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}

          

          {/* QuickActionRow: class progress for flat courses */}
          {selectedCourse && (selectedCourse.total_classes ?? 0) > 0 ? (() => {
            const completed = selectedCourse.completed_classes ?? 0;
            const total = selectedCourse.total_classes!;
            const pct = Math.min(Math.round((completed / total) * 100), 100);
            const isMin = completed === 0;
            const isMax = completed >= total;
            return (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
                paddingHorizontal: 10,
                paddingVertical: 7,
                backgroundColor: theme.colors.card,
                borderRadius: 10,
                borderWidth: 0.5,
                borderColor: theme.colors.border,
              }}>
                <TouchableOpacity
                  onPress={handleDecrementClass}
                  disabled={isMin}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: isMin ? theme.colors.border + '60' : theme.colors.primary + '12',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="remove" size={13} color={isMin ? theme.colors.text.placeholder : theme.colors.primary} />
                </TouchableOpacity>

                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text.primary, minWidth: 38, textAlign: 'center' }}>
                  {completed}<Text style={{ fontWeight: '400', color: theme.colors.text.placeholder, fontSize: 11 }}>/{total}</Text>
                </Text>

                <View style={{ flex: 1, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.border + '80', overflow: 'hidden' }}>
                  <View style={{
                    width: `${pct}%` as any,
                    height: '100%', borderRadius: 1.5,
                    backgroundColor: pct >= 100 ? '#34C759' : theme.colors.primary,
                  }} />
                </View>

                <Text style={{ fontSize: 10, color: theme.colors.text.placeholder, fontWeight: '500', minWidth: 28, textAlign: 'right' }}>
                  {pct}%
                </Text>

                <TouchableOpacity
                  onPress={handleIncrementClass}
                  disabled={isMax}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: isMax ? theme.colors.border + '60' : theme.colors.primary + '12',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="add" size={13} color={isMax ? theme.colors.text.placeholder : theme.colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })() : null}

          {/* Subjects carousel filtered by active course */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>
              {selectedDashboardCourseId === null
                ? 'Todas las materias'
                : selectedDashboardCourseId === 'independent'
                ? 'Materias independientes'
                : courses.find(c => c.id === selectedDashboardCourseId)?.name ?? 'Materias'}
            </Text>

            {filteredEnrichedSubjects.length === 0 ? (
              <View style={styles.emptySubjectsCard}>
                <Feather name="layout" size={22} color={theme.colors.text.placeholder} />
                <Text style={styles.emptySubjectsText}>
                  {selectedDashboardCourseId ? 'Sin materias en este curso' : t('dashboard.newSubject.emptyState')}
                </Text>
              </View>
            ) : (
              <FlatList
                ref={subjectsCarouselRef}
                horizontal
                data={carouselSubjects}
                keyExtractor={(item) => item.__key}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subjectsCarousel}
                renderItem={({ item }) => <SubjectTile subject={item} onEdit={handleEditSubject} onDelete={handleDeleteSubject} />}
                ItemSeparatorComponent={() => <View style={{ width: SUBJECT_CARD_GAP }} />}
                getItemLayout={(_, index) => ({
                  length: SUBJECT_CARD_WIDTH + SUBJECT_CARD_GAP,
                  offset: (SUBJECT_CARD_WIDTH + SUBJECT_CARD_GAP) * index,
                  index,
                })}
              />
            )}
          </View>
        </View>

        {/* ====================================================== */}
        {/* LO SIGUIENTE                                          */}
        {/* ====================================================== */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>{t('dashboard.upNext', { defaultValue: 'Lo siguiente' })}</Text>
          <View style={styles.grid}>
            {/* NEXT CLASS */}
            <UpNextCard
              title={t('dashboard.nextClass')}
              context={upNextClass.context}
              value={upNextClass.value}
              footer={upNextClass.footer}
              icon="time-outline"
              color={theme.colors.warning}
              accent={upNextClass.live ? theme.colors.warning : undefined}
              onPress={() => {
                if (upNextClass.subjectId) {
                  router.push(`/subjects/${upNextClass.subjectId}`);
                }
              }}
            />

            {/* NEXT ASSIGNMENT */}
            <UpNextCard
              title={t('dashboard.nextAssignment')}
              context={upNextTask.context}
              value={upNextTask.value}
              footer={upNextTask.footer}
              icon="document-text-outline"
              color={upNextTask.color}
            />
          </View>
        </View>

        {/* ====================================================== */}
        {/* ESTADO DEL APRENDIZAJE                                 */}
        {/* ====================================================== */}
        <View style={styles.section}>
          <KnowledgeHealthCard 
              snapshot={knowledgeSnapshot} 
              loading={knowledgeLoading || !knowledgeSnapshot} 
              onInfoPress={handleKnowledgeInfoPress}
            />
          <View style={{ marginTop: 20 }}>
            <DailyReviewCard
            cards={predictions?.cards ?? []}
            subjectNames={subjectNamesMap}
            onStart={() => setIsFlashcardsVisible(true)}
            predictionsSource={predictionsSource}
          />
          </View>
        </View>
        {/* 5. STUDY TOOLS */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>{t('dashboard.studyTools')}</Text>
          <View style={globalStyles.mb16}>
            <StudyTimerCard 
              refreshTrigger={timerRefreshTrigger}
              onOpenConfig={() => {
                setTimerViewState('config');
                setIsTimerModalVisible(true);
              }}
              onFinish={(duration, subjectId, mode) => {
                setLastSessionDuration(duration);
                setLastSessionSubjectId(subjectId);
                setLastSessionMode(mode);
                setTimerViewState('feedback');
                setIsTimerModalVisible(true);
              }}
            />
          </View>
          <View style={styles.actionsGrid}>
            <ActionCircle
              title={t('dashboard.flashcards', { defaultValue: 'Mazos' })}
              icon="cards-outline"
              color="#AF52DE"
              onPress={() => setIsFlashcardsVisible(true)}
            />
            <ActionCircle 
              title={t('dashboard.schedule', { defaultValue: 'Planificador' })} 
              icon="calendar-outline" 
              color="#FF9500" 
              onPress={() => setIsScheduleModalVisible(true)}
            />
            <ActionCircle 
              title={t('dashboard.audioRecorder')} 
              icon="microphone-outline" 
              color="#34C759" 
              onPress={() => setIsAudioModalVisible(true)}
            />
            <ActionCircle 
              title={t('dashboard.documentScanner')} 
              icon="file-document-outline" 
              color="#5856D6" 
              onPress={() => setIsScannerVisible(true)}
            />
          </View>
        </View>

        {/* 6. PERFORMANCE LEADERBOARD */}
        {userGroups.length > 0 && profile?.id ? (
          <GroupPerformanceLeaderboard groupPinId={userGroups[0].group_pin_id} currentUserId={profile.id} />
        ) : null}

        <CreateSubjectModal 
          visible={isSubjectModalVisible}
          onClose={() => {
            setIsSubjectModalVisible(false);
            loadData(true);
          }}
        />

        <CreateCourseModal
          visible={isCourseModalVisible}
          editingCourse={editingCourse}
          onClose={() => {
            setIsCourseModalVisible(false);
            setEditingCourse(null);
            loadData(true);
          }}
        />

      </ScrollView>
    </SafeAreaView>
      
      {/* CREATION MENU MODAL */}
      <Modal visible={isCreationMenuVisible} transparent animationType="fade" onRequestClose={() => setIsCreationMenuVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setIsCreationMenuVisible(false)}>
          <Pressable style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 16 + insets.bottom }} onPress={() => null}>
            <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 16 }}>¿Qué deseas crear?</Text>
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: theme.colors.background, borderRadius: 16, marginBottom: 12 }}
              onPress={() => { setIsCreationMenuVisible(false); setTimeout(() => { setEditingCourse(null); setIsCourseModalVisible(true); }, 300); }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FF950020', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                <Ionicons name="layers" size={24} color="#FF9500" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>Nuevo Curso</Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 4 }}>Agrupa materias de Udemy, Platzi, etc.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: theme.colors.background, borderRadius: 16 }}
              onPress={() => { setIsCreationMenuVisible(false); setTimeout(() => setIsSubjectModalVisible(true), 300); }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                <Ionicons name="book" size={24} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>Nueva Materia / Módulo</Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 4 }}>Para clases individuales de tu Universidad</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* TOAST FEEDBACK */}
      {toastMessage ? (
        <View style={styles.toastContainer}>
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.white} style={globalStyles.mr8} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* QUICK ADD MENU (ACTION SHEET) */}
      <Modal
        visible={isQuickAddMenuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsQuickAddMenuVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setIsQuickAddMenuVisible(false)}>
          <Pressable style={styles.sheetContent} onPress={() => null}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('dashboard.quickAddMenu.title')}</Text>
            <Text style={styles.sheetSubtitle}>{t('dashboard.quickAddDesc')}</Text>

            <View style={styles.quickAddMenuContainer}>
              <TouchableOpacity 
                style={styles.quickAddMenuItem} 
                onPress={() => {
                  setIsQuickAddMenuVisible(false);
                  setIsGradeModalVisible(true);
                }}
              >
                <View style={styles.quickAddMenuIcon}>
                  <MaterialCommunityIcons name="calculator" size={24} color={theme.colors.primary} />
                </View>
                <View style={styles.quickAddMenuInfo}>
                  <Text style={styles.quickAddMenuText}>{t('dashboard.quickAddMenu.registerGrade')}</Text>
                  <Text style={styles.quickAddMenuSubtext}>{t('dashboard.quickAddMenu.registerGradeSubtext')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.text.placeholder} style={styles.quickAddMenuChevron} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickAddMenuItem}
                onPress={() => {
                  setIsQuickAddMenuVisible(false);
                  setIsTaskModalVisible(true);
                }}
              >
                <View style={styles.quickAddMenuIcon}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={24} color="#34C759" />
                </View>
                <View style={styles.quickAddMenuInfo}>
                  <Text style={styles.quickAddMenuText}>{t('dashboard.quickAddMenu.newTask')}</Text>
                  <Text style={styles.quickAddMenuSubtext}>{t('dashboard.quickAddMenu.newTaskSubtext')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.text.placeholder} style={styles.quickAddMenuChevron} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickAddMenuItem}
                onPress={handleTakePhoto}
              >
                <View style={styles.quickAddMenuIcon}>
                  <MaterialCommunityIcons name="camera-outline" size={24} color="#FF9500" />
                </View>
                <View style={styles.quickAddMenuInfo}>
                  <Text style={styles.quickAddMenuText}>{t('dashboard.quickAddMenu.takePhotoLabel')}</Text>
                  <Text style={styles.quickAddMenuSubtext}>{t('dashboard.quickAddMenu.takePhotoSubtext')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.text.placeholder} style={styles.quickAddMenuChevron} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.sheetCancelBtn, { marginTop: 20 }]} onPress={() => setIsQuickAddMenuVisible(false)}>
              <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <EditSubjectModal
        visible={isEditSubjectModalVisible}
        subject={editingSubject}
        onClose={() => { setIsEditSubjectModalVisible(false); setEditingSubject(null); }}
      />

      <CreateGradeModal
        visible={isGradeModalVisible}
        onClose={() => setIsGradeModalVisible(false)}
        subjects={subjects}
        initialSubjectId={predictedSubjectId as string | null | undefined}
      />

      <CreateTaskModal
        visible={isTaskModalVisible}
        onClose={() => setIsTaskModalVisible(false)}
        subjects={subjects}
        initialSubjectId={predictedSubjectId as string | null | undefined}
        onTaskCreated={() => loadData()}
      />

      <SchedulePlannerModal
        visible={isScheduleModalVisible}
        onClose={() => setIsScheduleModalVisible(false)}
        subjects={subjects}
        allSchedules={allSchedules}
        onScheduleUpdated={() => loadData()}
      />
      
      {/* METRIC DETAIL MODAL */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleOpenQuickAdd}
      >
        <Ionicons name="add" size={32} color={theme.colors.white} />
      </TouchableOpacity>

      {isAudioModalVisible && (
        <AudioRecorderModal isVisible={true} onClose={() => setIsAudioModalVisible(false)} />
      )}

      {isTimerModalVisible && (
        <StudyTimerModal
          isVisible={true}
          onClose={() => setIsTimerModalVisible(false)}
          subjects={subjects}
          viewState={timerViewState}
          onStart={(config) => {
            const initialRemaining = config.mode === 'threshold' ? 0 : config.duration;
            AsyncStorage.setItem('@threshold_timer_state', JSON.stringify({
              isActive: true,
              isPaused: false,
              mode: config.mode,
              totalSeconds: config.duration,
              remainingSeconds: initialRemaining,
              subjectId: config.subjectId,
              lastSyncTime: Date.now(),
            })).then(() => {
              setTimerRefreshTrigger(prev => prev + 1);
              setIsTimerModalVisible(false);
            });
          }}
          onSaveFeedback={async (feedback) => {
            try {
              // Mapping string feedback to number rating (MVP)
              const ratingMap: Record<string, number> = {
                [t('dashboard.studyTimerModal.advanceOptions.great')]: 5,
                [t('dashboard.studyTimerModal.advanceOptions.good')]: 4,
                [t('dashboard.studyTimerModal.advanceOptions.ok')]: 3,
                [t('dashboard.studyTimerModal.advanceOptions.bad')]: 2,
                [t('dashboard.studyTimerModal.advanceOptions.terrible')]: 1,
              };
              const rating = ratingMap[feedback] || 3;

              await createStudySession({
                subject_id: lastSessionSubjectId as string | undefined,
                session_type: lastSessionMode === 'pomodoro' ? 'Pomodoro' : 'Threshold',
                duration_seconds: lastSessionDuration,
                performance_rating: rating,
              });
              showToast(t('dashboard.progressSaved'));
            } catch {
              showToast(t('dashboard.errorSavingSession'));
            }
          }}
        />
      )}

      {isScannerVisible && (
        <DocumentScannerModal
          isVisible={isScannerVisible}
          onClose={() => setIsScannerVisible(false)}
          subjects={subjects}
          onSave={() => loadData()}
        />
      )}

      {isPhotoModalVisible && (
        <PhotoCaptureModal
          isVisible={isPhotoModalVisible}
          onClose={() => setIsPhotoModalVisible(false)}
          subjects={subjects}
          onSave={() => loadData()}
        />
      )}

      <FlashcardsModal
        isVisible={isFlashcardsVisible}
        onClose={() => setIsFlashcardsVisible(false)}
        subjects={subjects}
      />

      {/* Snooze Modal */}
      <SnoozeModal
        key={`snooze-modal-${snoozeRefreshTrigger}`}
        visible={isSnoozeModalVisible}
        onClose={() => setIsSnoozeModalVisible(false)}
        onSelect={handleSnoozeSelection}
      />

      <ExplanationOverlay
        visible={overlayVisible}
        explanation={overlayText}
        onDismiss={() => setOverlayVisible(false)}
      />
    </>
  );
}
