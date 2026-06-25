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
import { getCurrentUserProfile, getPredictedSubject, getTodaySchedules, createStudySession, deleteSubject, type Subject, type UserProfile, type Assessment } from '../../src/services/api';
import { getUserGroups } from '../../src/services/api/learning/groups';
import { getGlobalGPAAnalytics } from '../../src/services/api/analytics';
import { calculateProjection } from '../../src/utils/projectionEngine';
import { useDataStore } from '../../src/store/useDataStore';
import { courseRepository } from '../../src/services/database/repositories';
import { Course } from '../../src/services/api/types';
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
import { GroupPerformanceLeaderboard } from '../../src/components/dashboard/GroupPerformanceLeaderboard';
import { CourseHeroCard, AllSubjectsHeroCard, HERO_CARD_WIDTH } from '../../src/components/dashboard/CourseHeroCard';
import { CreateSubjectModal } from '../../src/components/dashboard/CreateSubjectModal';
import { CreateCourseModal } from '../../src/components/dashboard/CreateCourseModal';
import { EditSubjectModal } from '../../src/components/dashboard/EditSubjectModal';
import { CreateGradeModal } from '../../src/components/dashboard/CreateGradeModal';
import { CreateTaskModal } from '../../src/components/dashboard/CreateTaskModal';
import { SchedulePlannerModal } from '../../src/components/dashboard/SchedulePlannerModal';
import { OfflineIndicator } from '../../src/components/ui/OfflineIndicator';



const SUBJECT_LOOP_THRESHOLD = 4;
const SUBJECT_LOOP_MULTIPLIER = 16;
const SUBJECT_CARD_WIDTH = 160;
const SUBJECT_CARD_GAP = 12;

export default function HybridDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [localProfileImageUri, setLocalProfileImageUri] = useState<string | null>(null);
  // ── Usar store global para subjects, assessments, schedules y predicciones ──
  const { subjects, assessments, schedules: storeSchedules, predictions, loadAllData, refreshPredictions, loadCachedPredictions, isSyncing, syncStatusMessage } = useDataStore();

  // Cargar perfil desde caché al montar para hidratación instantánea
  useEffect(() => {
    (async () => {
      const { getCurrentUserProfileSync } = await import('../../src/services/api/auth/profile');
      const cached = await getCurrentUserProfileSync();
      if (cached) setProfile(cached);
      const localUri = await getLocalProfileImageUri();
      if (localUri) setLocalProfileImageUri(localUri);
    })();
  }, []);
  const { preloadRelatedData } = useCachePreload();
  const [isSubjectModalVisible, setIsSubjectModalVisible] = useState(false);
  const [isCourseModalVisible, setIsCourseModalVisible] = useState(false);
  const [isCreationMenuVisible, setIsCreationMenuVisible] = useState(false);
  const [isEditSubjectModalVisible, setIsEditSubjectModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const subjectsCarouselRef = useRef<FlatList<any> | null>(null);
  
  const [courses, setCourses] = useState<Course[]>([]);
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

  // Profile ya fue inicializado síncronamente en el useState vía MMKV

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
      // ── Iniciar carga del store global (SQLite instantáneo + Cloud background) ──
      const now = Date.now();
      let storePromise = Promise.resolve();
      if (!skipFullReload && (now - lastFocusRefreshRef.current > FOCUS_REFRESH_THROTTLE_MS)) {
        lastFocusRefreshRef.current = now;
        storePromise = loadAllData(true);
      }

      const [userProfile, schedulesToday, groups] = await Promise.all([
        getCurrentUserProfile(),
        getTodaySchedules(),
        getUserGroups(),
        storePromise
      ]);

      setProfile(userProfile);

      if (userProfile?.profile_image) {
        const localUri = await downloadProfileImage(userProfile.profile_image);
        if (localUri) setLocalProfileImageUri(localUri);
      }

      setTodaySchedules(Array.isArray(schedulesToday) ? schedulesToday : []);

      if (Array.isArray(groups) && groups.length > 0) {
        setUserGroups(groups);
      }
      
      try {
        const dbCourses = await courseRepository.getAll();
        setCourses(dbCourses);
      } catch (err) {
        console.warn('Error loading courses in dashboard:', err);
      }
      
      // ── Obtener GPA general ──
      try {
        const gpaData = await getGlobalGPAAnalytics();
        setOverallGpa(gpaData.currentAverage);
      } catch {
        // Silently fail — GPA no es crítico
      }
      
      // 🔁 Pre-cargar datos relacionados en background (no bloquea)
      preloadRelatedData().catch(err => console.warn('[Dashboard] Error preloading:', err));
    } catch (err) {
      console.warn('Error loading dashboard data:', err);
    }
  }, [loadAllData, preloadRelatedData, FOCUS_REFRESH_THROTTLE_MS]);

  // Handle pull-to-refresh: actualizar datos y predicciones
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    lastFocusRefreshRef.current = 0; // Reset throttle to force full reload
    try {
      await Promise.all([
        loadData(),
        profile?.id ? refreshPredictions(profile.id) : Promise.resolve(),
        getGlobalGPAAnalytics().then(d => setOverallGpa(d.currentAverage)).catch(() => {}),
      ]);
    } catch (err) {
      console.warn('Error refreshing dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, profile?.id, refreshPredictions]);

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
      // On first focus, triggers full reload (throttled to 5 min).
      // Subsequent focuses skip the full subject/assessment/schedule cloud refresh
      // to avoid the cloud call storm on every tab switch.
      loadData(false);
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
        setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
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
        setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
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
                    return (
                      <AllSubjectsHeroCard
                        subjects={enrichedSubjects}
                        isActive={selectedDashboardCourseId === null}
                        onPress={() => handleHeroCardSelect(null)}
                      />
                    );
                  }
                  if (item.type === 'independent') {
                    const independentSubjects = enrichedSubjects.filter(s => !s.course_id);
                    return (
                      <CourseHeroCard
                        course={{ id: 'independent', user_id: '', name: 'Materias Independientes' }}
                        subjects={independentSubjects}
                        isActive={selectedDashboardCourseId === 'independent'}
                        onPress={() => handleHeroCardSelect('independent')}
                      />
                    );
                  }
                  const courseSubjects = enrichedSubjects.filter(s => s.course_id === item.course.id);
                  return (
                    <CourseHeroCard
                      course={item.course}
                      subjects={courseSubjects}
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
          {selectedCourse && isFlatCourse && selectedCourse.total_classes ? (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 12,
              paddingHorizontal: 8,
              paddingVertical: 10,
              backgroundColor: theme.colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
              <TouchableOpacity
                onPress={handleDecrementClass}
                disabled={(selectedCourse.completed_classes ?? 0) === 0}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: (selectedCourse.completed_classes ?? 0) === 0
                    ? theme.colors.border : theme.colors.primary + '20',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="remove"
                  size={22}
                  color={(selectedCourse.completed_classes ?? 0) === 0
                    ? theme.colors.text.placeholder : theme.colors.primary}
                />
              </TouchableOpacity>

              <View style={{ alignItems: 'center', flex: 1 }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'baseline', gap: 2,
                }}>
                  <Text style={{
                    fontSize: 26, fontWeight: '800', color: theme.colors.text.primary,
                  }}>
                    {selectedCourse.completed_classes ?? 0}
                  </Text>
                  <Text style={{
                    fontSize: 18, fontWeight: '600', color: theme.colors.text.placeholder,
                  }}>
                    /{selectedCourse.total_classes}
                  </Text>
                </View>
                <View style={{
                  width: '80%', height: 4, borderRadius: 2,
                  backgroundColor: theme.colors.border, marginTop: 4, overflow: 'hidden',
                }}>
                  <View style={{
                    width: `${Math.min(
                      ((selectedCourse.completed_classes ?? 0) / selectedCourse.total_classes) * 100, 100
                    )}%` as any,
                    height: '100%', borderRadius: 2,
                    backgroundColor: theme.colors.primary,
                  }} />
                </View>
                <Text style={{
                  fontSize: 11, color: theme.colors.text.placeholder, marginTop: 4,
                }}>
                  clases vistas
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleIncrementClass}
                disabled={(selectedCourse.completed_classes ?? 0) >= selectedCourse.total_classes}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: (selectedCourse.completed_classes ?? 0) >= selectedCourse.total_classes
                    ? theme.colors.border : theme.colors.primary + '20',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={(selectedCourse.completed_classes ?? 0) >= selectedCourse.total_classes
                    ? theme.colors.text.placeholder : theme.colors.primary}
                />
              </TouchableOpacity>
            </View>
          ) : null}

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

        {/* 3. QUICK ADD & NEXT CLASS */}
        <View style={styles.section}>


          <Text style={styles.sectionTitle}>{t('dashboard.nextClass')}</Text>
          <View style={styles.nextClassCard}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.nextClassBadge}>
                <Ionicons name="time-outline" size={24} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                {nextClass ? (
                  <>
                    <Text style={styles.nextClassTitle} numberOfLines={1}>{nextClass.name}</Text>
                    <Text style={styles.nextClassRoom} numberOfLines={1}>
                      {nextClass.start_time} - {nextClass.end_time}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.nextClassTitle} numberOfLines={1}>{todaySchedules.length > 0 ? t('dashboard.doneForToday') : t('dashboard.noClasses')}</Text>
                    <Text style={styles.nextClassRoom} numberOfLines={1}>{t('dashboard.enjoyDay')}</Text>
                  </>
                )}
              </View>
            </View>
            {nextClass ? (
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => {
                  const nextSubjectId = nextClass?.subject_id;
                  if (nextSubjectId) {
                    router.push(`/subjects/${nextSubjectId}`);
                  }
                }}
              >
                <Text style={styles.openBtnText}>{t('dashboard.openBtn')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {predictions && predictions.dueCount > 0 && !snoozeManager.isCardSnoozed('due_cards_alert') ? (
            <View style={{ marginTop: 24 }}>
              <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('dashboard.urgentReviews')}</Text>
                <View style={globalStyles.rowBetweenCenter}>
                  <TouchableOpacity
                    style={[styles.snoozeBtn, { marginRight: 10 }]}
                    onPress={() => setIsSnoozeModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="pause-circle" size={18} color={theme.colors.warning} />
                  </TouchableOpacity>
                  <View style={[styles.allChip, { backgroundColor: theme.colors.dangerTransparent, borderWidth: 1, borderColor: theme.colors.danger + '20', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Text style={[styles.allChipText, { color: theme.colors.danger, fontWeight: '800' }]}>{predictions.dueCount}</Text>
                    <Text style={[styles.allChipText, { color: theme.colors.danger, fontWeight: '500', fontSize: 10 }]}>{t('dashboard.decks')}</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.nextClassCard, { gap: 12 }]}>
                <View style={[styles.nextClassBadge, { backgroundColor: theme.colors.dangerTransparent, flexShrink: 0 }]}>
                  <MaterialCommunityIcons name="brain" size={24} color={theme.colors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextClassTitle} numberOfLines={1}>{t('dashboard.attentionRequired')}</Text>
                  <Text style={styles.nextClassRoom} numberOfLines={1}>
                    {predictions.dueCount === 1
                      ? t('dashboard.deckToReview')
                      : t('dashboard.decksToReview', { count: predictions.dueCount })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.openBtn, { borderColor: theme.colors.danger + '30', flexShrink: 0 }]}
                  onPress={() => setIsFlashcardsVisible(true)}
                >
                  <Text style={[styles.openBtnText, { color: theme.colors.danger }]}>{t('dashboard.reviewBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        {/* 4. ORIGINAL METRICS (2x2) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.overview')}</Text>
          <View style={styles.grid}>
            <MetricCard 
              title={t('dashboard.todaysSchedule')} 
              value={todaySchedules.length.toString()} 
              subtext={t('dashboard.classes')} 
              icon="calendar-outline" 
              color="#FF9500" 
              onPress={() => setIsScheduleModalVisible(true)}
            />
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

        {/* 5. STUDY TOOLS (Fixed Row) */}
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
              title={t('dashboard.flashcards')}
              icon="cards-outline"
              color="#AF52DE"
              onPress={() => setIsFlashcardsVisible(true)}
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
          getTodaySchedules().then(res => setTodaySchedules(Array.isArray(res) ? res : []));
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
