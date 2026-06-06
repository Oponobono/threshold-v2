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
import { getGlobalGPAAnalytics } from '../../src/services/api/analytics';
import { calculateProjection } from '../../src/utils/projectionEngine';
import { useDataStore } from '../../src/store/useDataStore';
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
import { SubjectTile, MetricCard, ActionCircle, PerformanceRow } from '../../src/components/dashboard/DashboardWidgets';
import { CreateSubjectModal } from '../../src/components/dashboard/CreateSubjectModal';
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
  const { subjects, assessments, schedules: storeSchedules, predictions, loadAllData, refreshPredictions, loadCachedPredictions } = useDataStore();

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
  const [isEditSubjectModalVisible, setIsEditSubjectModalVisible] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const subjectsCarouselRef = useRef<FlatList<any> | null>(null);

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

  // Profile ya fue inicializado síncronamente en el useState vía MMKV

  // Snooze State
  const snoozeManager = useDueCardSnooze();
  const [isSnoozeModalVisible, setIsSnoozeModalVisible] = useState(false);
  const [snoozeRefreshTrigger, setSnoozeRefreshTrigger] = useState(0); // Trigger para re-render cuando cambia snooze

  // Escuchar cambios en snoozedCards y actualizar trigger
  useEffect(() => {
    setSnoozeRefreshTrigger(prev => prev + 1);
  }, [snoozeManager.snoozedCards]);

  const loadData = useCallback(async () => {
    try {
      const [userProfile, schedulesToday] = await Promise.all([
        getCurrentUserProfile(),
        getTodaySchedules(),
      ]);

      setProfile(userProfile);

      if (userProfile?.profile_image) {
        const localUri = await downloadProfileImage(userProfile.profile_image);
        if (localUri) setLocalProfileImageUri(localUri);
      }

      setTodaySchedules(Array.isArray(schedulesToday) ? schedulesToday : []);
      
      // 💾 Profile is cached by getCurrentUserProfile internally
      
      // ── Cargar datos globales del store (subjects, assessments, schedules) ──
      await loadAllData(true);

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
  }, [loadAllData, preloadRelatedData]);

  // Handle pull-to-refresh: actualizar datos y predicciones
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
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
      loadData();
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
  }, [profile?.username, fullName, profile]);

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

  const carouselSubjects = useMemo(() => {
    if (!enrichedSubjects.length) return [] as (Subject & { __key: string })[];

    if (!shouldUseInfiniteCarousel) {
      return enrichedSubjects.map((subject) => ({
        ...subject,
        __key: `${subject.id}`,
      }));
    }

    const result: (Subject & { __key: string })[] = [];
    for (let loop = 0; loop < SUBJECT_LOOP_MULTIPLIER; loop += 1) {
      for (const subject of enrichedSubjects) {
        result.push({
          ...subject,
          __key: `${subject.id}-${loop}`,
        });
      }
    }
    return result;
  }, [enrichedSubjects, shouldUseInfiniteCarousel]);

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

        {/* 2. YOUR SUBJECTS */}
        <View style={styles.section}>
          <View style={styles.subjectsHeaderRow}>
            <Text style={styles.sectionTitle}>{t('dashboard.yourSubjects')}</Text>
            <TouchableOpacity style={styles.subjectsAddBtn} onPress={() => setIsSubjectModalVisible(true)}>
              <Ionicons name="add" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          {subjects.length === 0 ? (
            <View style={styles.emptySubjectsCard}>
              <Feather name="layout" size={22} color={theme.colors.text.placeholder} />
              <Text style={styles.emptySubjectsText}>{t('dashboard.newSubject.emptyState')}</Text>
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
              initialScrollIndex={initialScrollIndex}
              getItemLayout={(_, index) => ({
                length: SUBJECT_CARD_WIDTH + SUBJECT_CARD_GAP,
                offset: (SUBJECT_CARD_WIDTH + SUBJECT_CARD_GAP) * index,
                index,
              })}
              onMomentumScrollEnd={(event) => normalizeCarouselPosition(event.nativeEvent.contentOffset.x)}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  subjectsCarouselRef.current?.scrollToIndex({ index, animated: false });
                }, 50);
              }}
            />
          )}
        </View>

        {/* 3. QUICK ADD & NEXT CLASS */}
        <View style={styles.section}>
          <View style={styles.quickAddCard}>
            <View style={[globalStyles.rowCenter, globalStyles.mb8]}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.text.primary} style={globalStyles.mr8} />
              <Text style={styles.quickAddTitle}>{t('dashboard.quickAdd')}</Text>
            </View>
            <Text style={styles.quickAddDesc}>{t('dashboard.quickAddDesc')}</Text>
            <TouchableOpacity style={styles.quickAddBtn} onPress={() => setIsQuickAddMenuVisible(true)}>
              <Text style={styles.quickAddBtnText}>{t('dashboard.addBtn')}</Text>
            </TouchableOpacity>
          </View>

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
        <View style={styles.section}>
          <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
            <Text style={styles.sectionTitle}>{t('dashboard.performance')}</Text>
            <View style={styles.allChip}><Text style={styles.allChipText}>{t('dashboard.filterAll')}</Text></View>
          </View>
          
          <View style={styles.perfContainer}>
            <PerformanceRow rank="1" name={t('dashboard.top')} gpa="3.92" icon="trophy" iconColor="#FFD700" />
            <PerformanceRow rank="2" name={t('dashboard.peerB')} gpa="3.70" icon="medal" iconColor="#C0C0C0" />
            <PerformanceRow rank="3" name={t('dashboard.peerC')} gpa="3.45" icon="medal" iconColor="#CD7F32" />
            <PerformanceRow rank="7" name={t('dashboard.you')} gpa="2.90" icon="person-circle" iconColor={theme.colors.primary} isYou />
          </View>
        </View>

        <CreateSubjectModal 
          visible={isSubjectModalVisible}
          onClose={() => setIsSubjectModalVisible(false)}
        />

      </ScrollView>
    </SafeAreaView>
      
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
