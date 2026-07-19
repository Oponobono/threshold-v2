import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable, FlatList, RefreshControl } from 'react-native';
import LottieView from 'lottie-react-native';
import { alertRef } from '../../src/components/ui/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { dashboardStyles as styles } from '../../src/styles/Dashboard.styles';
import { getPredictedSubject, createStudySession, deleteSubject } from '../../src/services/api';
import type { UserProfile } from '../../src/services/api/types';
import type { Subject, Assessment } from '../../src/services/database/repositories';
import { calculateProjection } from '../../src/utils/projectionEngine';
import { useDataStore } from '../../src/store/useDataStore';
import { courseRepository } from '../../src/services/database/repositories';
import type { Course } from '../../src/services/api/types';
import { usePredictionPolling } from '../../src/hooks/usePredictionPolling';
import { useCachePreload } from '../../src/hooks/useCachePreload';
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
import { SubjectTile, MetricCard, ActionCircle } from '../../src/components/dashboard/DashboardWidgets';
import { NextClassCard } from '../../src/components/dashboard/NextClassCard';
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



const SUBJECT_LOOP_THRESHOLD = 4;
const SUBJECT_LOOP_MULTIPLIER = 16;
const SUBJECT_CARD_WIDTH = 160;
const SUBJECT_CARD_GAP = 12;


export default function HybridDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // ── Usar store global para subjects, assessments, schedules y predicciones ──
  const { subjects, assessments, schedules: storeSchedules, predictions, loadAllData, refreshPredictions, loadCachedPredictions, isSyncing, syncStatusMessage, courses, profile: storeProfile, userGroups: storeGroups, overallGpa: storeOverallGpa, refreshProfile, refreshUserGroups, refreshOverallGpa, syncTodaySchedules } = useDataStore();
  const [profile, setProfile] = useState<UserProfile | null>(storeProfile);
  const [localProfileImageUri, setLocalProfileImageUri] = useState<string | null>(null);

  // Cargar datos locales al montar para hidratación instantánea
  useEffect(() => {
    (async () => {
      const { userRepository } = await import('../../src/services/database/repositories/UserRepository');
      const currentUser = await userRepository.getCurrentUser();
      if (currentUser) setProfile(currentUser as any);

      const localUri = await getLocalProfileImageUri();
      if (localUri) setLocalProfileImageUri(localUri);

      const { storageService } = await import('../../src/services/storageService');
      const groupsCache = await storageService.getLocal('app:cache:userGroups');
      if (groupsCache) {
        try { setUserGroups(JSON.parse(groupsCache)); } catch {}
      }

      const gpaCache = await storageService.getLocal('app:cache:global_gpa');
      if (gpaCache) {
        try {
          const parsed = JSON.parse(gpaCache);
          setOverallGpa(parsed.currentAverage ?? null);
        } catch {}
      }
    })();
  }, []);
  // Sync en background después del primer render (no bloquea)
  useEffect(() => {
    refreshProfile();
    refreshUserGroups();
    refreshOverallGpa();
    syncTodaySchedules();
  }, []);

  const { preloadRelatedData } = useCachePreload();
  const [isSubjectModalVisible, setIsSubjectModalVisible] = useState(false);
  const [isCourseModalVisible, setIsCourseModalVisible] = useState(false);
  const [isCreationMenuVisible, setIsCreationMenuVisible] = useState(false);
  const [isEditSubjectModalVisible, setIsEditSubjectModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const subjectsCarouselRef = useRef<FlatList<any> | null>(null);
  
  const [selectedDashboardCourseId, setSelectedDashboardCourseId] = useState<string | null>(null); // null = "todas"
  const heroCarouselRef = useRef<FlatList<any> | null>(null);

  // Quick Add Menu states
  const [isQuickAddMenuVisible, setIsQuickAddMenuVisible] = useState(false);
  const [isGradeModalVisible, setIsGradeModalVisible] = useState(false);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [predictedSubjectId, setPredictedSubjectId] = useState<string | null>(null);

  const [selectedMetric, setSelectedMetric] = useState<any>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]);
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
  const [overallGpa, setOverallGpa] = useState<number | null>(null);
  const [userGroups, setUserGroups] = useState<any[]>([]);

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

      const currentSchedules = useDataStore.getState().schedules;
      const today = new Date().getDay();
      setTodaySchedules(
        currentSchedules.filter((s: any) => s.day_of_week === today)
      );

      const currentProfile = useDataStore.getState().profile;
      if (currentProfile) setProfile(currentProfile);

      const currentGroups = useDataStore.getState().userGroups;
      if (Array.isArray(currentGroups) && currentGroups.length > 0) {
        setUserGroups(currentGroups);
      }

      const currentGpa = useDataStore.getState().overallGpa;
      if (currentGpa != null) setOverallGpa(currentGpa);

      setTimeout(() => {
        preloadRelatedData().catch(err => console.warn('[Dashboard] Error preloading:', err));
      }, 3000);
    } catch (err) {
      console.warn('Error loading dashboard data:', err);
    }
  }, [loadAllData, preloadRelatedData, FOCUS_REFRESH_THROTTLE_MS]);

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

  // Derivar el próximo examen directamente de los datos del store
  const nextAssessment = useMemo(() => {
    if (!Array.isArray(assessments) || assessments.length === 0) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcoming = assessments.filter((a: Assessment) => {
      if (a.is_completed || !a.date) return false;
      try {
        const [d, m, y] = a.date.split('-').map(Number);
        const taskDate = new Date(y, m - 1, d);
        return taskDate.getTime() >= today.getTime();
      } catch {
        return false;
      }
    });
    
    const sorted = upcoming.sort((a: Assessment, b: Assessment) => {
      try {
        if (!a.date || !b.date) return 0;
        const [da, ma, ya] = a.date.split('-').map(Number);
        const [db, mb, yb] = b.date.split('-').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      } catch {
        return 0;
      }
    });

    return sorted[0] || null;
  }, [assessments]);

  useFocusEffect(
    React.useCallback(() => {
      // Skip full reload on focus — useProgressiveDataLoading in tab layout
      // handles data loading. Only update derived state (schedules, profile).
      loadData(true);
    }, [loadData])
  );

  // ── Cargar predicciones al enfocar: primero del cache, luego actualizar con polling ───
  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      // Solo cargar del cache al enfocar
      loadCachedPredictions?.();
    }, [profile?.id, loadCachedPredictions])
  );

  // ── Polling de predicciones cada 15 minutos ───────────────────────────────
  usePredictionPolling(profile?.id, true);

  // ── KnowledgeSnapshot (carga al montar, refresh manual) ───────────────────
  const { snapshot: knowledgeSnapshot, loading: knowledgeLoading } = useKnowledgeInsights(profile?.id);

  const fullName = useMemo(() => {
    const first = profile?.name?.trim() || '';
    const last = profile?.lastname?.trim() || '';
    return `${first} ${last}`.trim();
  }, [profile]);

  const nickname = useMemo(() => {
    const finalNickname = profile?.username?.trim() || fullName || '';
    console.log('[Dashboard] Perfil cargado:', JSON.stringify(profile));
    console.log('[Dashboard] Nickname calculado:', finalNickname);
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
      await courseRepository.incrementClass(selectedCourse.id);
      const updated = await courseRepository.getById(selectedCourse.id);
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
      await courseRepository.decrementClass(selectedCourse.id);
      const updated = await courseRepository.getById(selectedCourse.id);
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



  const nextClass = useMemo(() => {
    if (!Array.isArray(todaySchedules) || todaySchedules.length === 0) return null;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    // Encuentra la primera clase que termina en el futuro (o ahora)
    return todaySchedules.find((s: any) => s.end_time >= currentTime) || null;
  }, [todaySchedules]);

  const subjectNamesMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of subjects) {
      map[String(s.id)] = s.name;
    }
    return map;
  }, [subjects]);

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
              <Image 
                source={{ uri: profileAvatarUri }} 
                style={styles.avatar} 
              />
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
        {/* ORIENTATION & TODAY FOCUS                              */}
        {/* ====================================================== */}
        <View style={styles.section}>
          {/* --- ORIENTATION --- */}
          <View style={{ marginBottom: 24 }}>
            <KnowledgeHealthCard snapshot={knowledgeSnapshot} loading={knowledgeLoading || !knowledgeSnapshot} />
          </View>

          {/* --- TODAY FOCUS --- */}
          <DailyReviewCard
            cards={predictions?.cards ?? []}
            subjectNames={subjectNamesMap}
            onStart={() => setIsFlashcardsVisible(true)}
          />

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('dashboard.upNext', { defaultValue: 'Lo siguiente' })}</Text>
          <View style={styles.grid}>
            {/* NEXT CLASS */}
            {(() => {
              let nextClassSubtext = t('dashboard.enjoyDay');
              if (nextClass) {
                const now = new Date();
                const [startH, startM] = nextClass.start_time.split(':').map(Number);
                const classStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM, 0);
                const diffMins = Math.floor((classStart.getTime() - now.getTime()) / 60000);
                
                if (diffMins > 0) {
                  const h = Math.floor(diffMins / 60);
                  const m = diffMins % 60;
                  if (h > 0) {
                    nextClassSubtext = m > 0 ? `En ${h}h ${m}m` : `En ${h}h`;
                  } else {
                    nextClassSubtext = `En ${m} min`;
                  }
                } else {
                  nextClassSubtext = `En curso`;
                }
              }

              return (
                <MetricCard 
                  title={t('dashboard.nextClass')}
                  value={nextClass ? nextClass.name : (todaySchedules.length > 0 ? t('dashboard.doneForToday') : t('dashboard.noClasses'))}
                  subtext={nextClassSubtext}
                  icon="time-outline"
                  color={nextClass ? theme.colors.primary : "#5856D6"}
                  showMood={false}
                  onPress={() => {
                    if (nextClass?.subject_id) {
                      router.push(`/subjects/${nextClass.subject_id}`);
                    } else {
                      setSelectedMetric({
                        title: t('dashboard.nextClass'),
                        value: todaySchedules.length > 0 ? t('dashboard.doneForToday') : t('dashboard.noClasses'),
                        subtext: t('dashboard.enjoyDay'),
                        icon: "time-outline",
                        color: "#5856D6"
                      });
                    }
                  }}
                />
              );
            })()}

            {/* NEXT ASSIGNMENT */}
            {(() => {
              const mood = nextAssessment?.date ? (() => {
                const [d, m, y] = nextAssessment.date.split('-').map(Number);
                const dueDate = new Date(y, m - 1, d);
                const today = new Date();
                today.setHours(0,0,0,0);
                const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays <= 1) return { color: '#FF3B30', show: true };
                if (diffDays <= 3) return { color: '#FF9500', show: true };
                return { color: '#34C759', show: true };
              })() : { color: '#5856D6', show: false };

              return (
                <MetricCard 
                  title={t('dashboard.nextAssignment')} 
                  value={nextAssessment ? nextAssessment.name : t('dashboard.nothingPending')} 
                  subtext={nextAssessment ? nextAssessment.date : t('dashboard.takeABreak')} 
                  icon="document-text-outline" 
                  color={mood.color}
                  showMood={mood.show}
                  onPress={() => setSelectedMetric({
                    title: t('dashboard.nextAssignment'),
                    value: nextAssessment ? nextAssessment.name : "Nada pendiente",
                    subtext: nextAssessment ? nextAssessment.date : t('dashboard.takeABreak'),
                    icon: "document-text-outline",
                    color: mood.color
                  })}
                />
              );
            })()}
          </View>
        </View>

        {/* ====================================================== */}
        {/* ECOSYSTEM                                              */}
        {/* ====================================================== */}
        {/* 2. COURSE HERO + YOUR SUBJECTS */}
        <View style={styles.section}>
          {/* Section header */}
          <View style={styles.subjectsHeaderRow}>
            <Text style={styles.sectionTitle}>Tus cursos</Text>
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
                  if (item.type === 'all') {
                    const globalViewModel = globalHeroPresenter.build({
                      subjects: enrichedSubjects,
                      courses,
                      assessments,
                      healthScore: knowledgeSnapshot?.health.score,
                    });
                    return (
                      <AllSubjectsHeroCard
                        viewModel={globalViewModel}
                        isActive={selectedDashboardCourseId === null}
                        onPress={() => handleHeroCardSelect(null)}
                      />
                    );
                  }
                   if (item.type === 'independent') {
                    const independentSubjects = enrichedSubjects.filter(s => !s.course_id);
                    const independentCourse = { id: 'independent', user_id: '', name: 'Materias Independientes' } as Course;
                    const primaryKnowledge = knowledgeSnapshot?.subjects
                      ?.filter(s => independentSubjects.some(is_ => is_.id === s.subjectId))
                      .sort((a, b) => a.retrievability - b.retrievability)[0];
                    const viewModel = courseHeroPresenter.build({
                      course: independentCourse,
                      subjects: independentSubjects,
                      primaryKnowledge: primaryKnowledge ? {
                        subjectId: primaryKnowledge.subjectId,
                        subjectName: primaryKnowledge.subjectName,
                        score: Math.round(primaryKnowledge.retrievability),
                        memoryLevel: primaryKnowledge.memoryLevel,
                        retrievability: primaryKnowledge.retrievability,
                      } : undefined,
                    });
                    return (
                      <CourseHeroCard
                        viewModel={viewModel}
                        isActive={selectedDashboardCourseId === 'independent'}
                        onPress={() => handleHeroCardSelect('independent')}
                      />
                    );
                  }
                  const courseSubjects = enrichedSubjects.filter(s => s.course_id === item.course.id);
                  const primaryKnowledge = knowledgeSnapshot?.subjects
                    ?.filter(s => courseSubjects.some(cs => cs.id === s.subjectId))
                    .sort((a, b) => a.retrievability - b.retrievability)[0];
                  const viewModel = courseHeroPresenter.build({
                    course: item.course,
                    subjects: courseSubjects,
                    primaryKnowledge: primaryKnowledge ? {
                      subjectId: primaryKnowledge.subjectId,
                      subjectName: primaryKnowledge.subjectName,
                      score: Math.round(primaryKnowledge.retrievability),
                      memoryLevel: primaryKnowledge.memoryLevel,
                      retrievability: primaryKnowledge.retrievability,
                    } : undefined,
                  });
                  return (
                    <CourseHeroCard
                      viewModel={viewModel}
                      isActive={selectedDashboardCourseId === item.course.id}
                      onPress={() => handleHeroCardSelect(item.course.id)}
                      onEditPress={() => handleEditCourse(item.course)}
                      onDeletePress={() => handleDeleteCourse(item.course)}
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
        {/* 5. STUDY TOOLS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.studyTools')}</Text>
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
            <NextClassCard onPress={() => setIsScheduleModalVisible(true)} />
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
          <Pressable style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }} onPress={() => null}>
            <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 16 }}>¿Qué deseas crear?</Text>
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: theme.colors.background, borderRadius: 16, marginBottom: 12 }}
              onPress={() => { setIsCreationMenuVisible(false); setTimeout(() => setIsSubjectModalVisible(true), 300); }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                <Ionicons name="book" size={24} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>Nueva Materia / Módulo</Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 4 }}>Para clases individuales de tu Universidad</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: theme.colors.background, borderRadius: 16 }}
              onPress={() => { setIsCreationMenuVisible(false); setTimeout(() => { setEditingCourse(null); setIsCourseModalVisible(true); }, 300); }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FF950020', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                <Ionicons name="layers" size={24} color="#FF9500" />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>Nuevo Curso</Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 4 }}>Agrupa materias de Udemy, Platzi, etc.</Text>
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
        onScheduleUpdated={() => {
          const s = useDataStore.getState().schedules;
          const today = new Date().getDay();
          setTodaySchedules(s.filter((sch: any) => sch.day_of_week === today));
        }}
      />
      
      {/* METRIC DETAIL MODAL */}
      <Modal
        visible={!!selectedMetric}
        transparent
        animationType="fade"
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedMetric(null)}>
          <View style={[styles.sheetContent, { marginHorizontal: 20, marginBottom: 'auto', marginTop: 'auto', borderRadius: 32 }]}>
            <View style={styles.sheetHandle} />
            {selectedMetric ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <View style={[styles.iconBox, { backgroundColor: selectedMetric.color + '20', width: 60, height: 60, borderRadius: 20, marginBottom: 16 }]}>
                  <Ionicons name={selectedMetric.icon} size={30} color={selectedMetric.color} />
                </View>
                <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>{selectedMetric.title}</Text>
                <Text style={[styles.cardValue, { fontSize: 22, textAlign: 'center', paddingHorizontal: 10 }]}>
                  {selectedMetric.value}
                </Text>
                <Text style={[styles.greetingSubtext, { marginTop: 8 }]}>
                  {selectedMetric.subtext}
                </Text>
                
                <TouchableOpacity 
                  style={[styles.sheetSaveBtn, { width: '100%', marginTop: 32 }]} 
                  onPress={() => setSelectedMetric(null)}
                >
                  <Text style={styles.sheetSaveText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Modal>
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
    </>
  );
}
