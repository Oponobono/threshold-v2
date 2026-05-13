import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Pressable, TextInput, FlatList, Animated, Easing } from 'react-native';
import LottieView from 'lottie-react-native';
import { alertRef } from '../../src/components/CustomAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ThresholdDatePicker } from '../../src/components/ThresholdDatePicker';
import { useTranslation } from 'react-i18next';
import { useRouter, useFocusEffect } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { dashboardStyles as styles } from '../../src/styles/Dashboard.styles';
import { createSubject, getCurrentUserProfile, getSubjects, createAssessment, getAssessments, getPredictedSubject, getTodaySchedules, createSchedule, deleteSchedule, getAllSchedules, createStudySession, getPredictions, type Subject, type UserProfile, type Assessment, type PredictionResponse } from '../../src/services/api';
import { StudyTimerCard } from '../../src/components/StudyTimerCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
const AudioRecorderModal = React.lazy(() => import('../../src/components/AudioRecorderModal').then(m => ({ default: m.AudioRecorderModal })));
const StudyTimerModal = React.lazy(() => import('../../src/components/StudyTimerModal').then(m => ({ default: m.StudyTimerModal })));
// Lazy load DocumentScannerModal to prevent native module load errors
const DocumentScannerModal = React.lazy(() => import('../../src/components/DocumentScannerModal').then(m => ({ default: m.DocumentScannerModal })));
const PhotoCaptureModal = React.lazy(() => import('../../src/components/PhotoCaptureModal').then(m => ({ default: m.PhotoCaptureModal })));
const FlashcardsModal = React.lazy(() => import('../../src/components/FlashcardsModal').then(m => ({ default: m.FlashcardsModal })));


const SUBJECT_COLORS = [
  '#E7EDF8', '#DDE7FF', '#EAF4EE', '#FCEFD9', '#F7E9EE', '#ECE8FF',
  '#E3F2FD', '#F2F5D9', '#F3ECE6', '#DDF3F0', '#EDEDED', '#D7E3FC',
  '#CDEAC0', '#FFD6BA', '#FFC8DD', '#CDE7F0', '#E8F0D8', '#E6E2D3',
];
const SUBJECT_ICONS = [
  'book-outline',
  'book-open-variant',
  'notebook-outline',
  'calculator-variant-outline',
  'atom-variant',
  'flask-outline',
  'code-tags',
  'chart-line',
  'abacus',
  'sigma',
  'brain',
  'earth',
  'palette-outline',
  'music-note-outline',
  'scale-balance',
  'gavel',
  'dna',
  'laptop',
  'compass-outline',
  'lightbulb-on-outline',
] as const;

const SUBJECT_LOOP_THRESHOLD = 4;
const SUBJECT_LOOP_MULTIPLIER = 16;
const SUBJECT_CARD_WIDTH = 208;
const SUBJECT_CARD_GAP = 12;

export default function HybridDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isSubjectModalVisible, setIsSubjectModalVisible] = useState(false);
  const [isSavingSubject, setIsSavingSubject] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectProfessor, setSubjectProfessor] = useState('');
  const [subjectTarget, setSubjectTarget] = useState('');
  const [selectedColor, setSelectedColor] = useState(SUBJECT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState<(typeof SUBJECT_ICONS)[number]>('book-outline');
  const subjectsCarouselRef = useRef<FlatList<any> | null>(null);

  // Quick Add Menu states
  const [isQuickAddMenuVisible, setIsQuickAddMenuVisible] = useState(false);
  const [isGradeModalVisible, setIsGradeModalVisible] = useState(false);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  
  // Grade Form states
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [gradeName, setGradeName] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [gradePercentage, setGradePercentage] = useState('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  
  // Task Form states
  const [taskName, setTaskName] = useState('');
  const [taskDate, setTaskDate] = useState(() => {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    return `${d}-${m}-${y}`;
  });
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Subject Selector state
  const [isSubjectSelectorVisible, setIsSubjectSelectorVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<any>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [nextAssessment, setNextAssessment] = useState<Assessment | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse | null>(null);
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]);
  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleDraftKeys, setScheduleDraftKeys] = useState<Set<string>>(new Set());
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const scheduleSheetAnim = useRef(new Animated.Value(500)).current;

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
  const [lastSessionSubjectId, setLastSessionSubjectId] = useState<number | null>(null);
  const [lastSessionMode, setLastSessionMode] = useState<'pomodoro' | 'threshold'>('pomodoro');

  const loadData = async () => {
    const [userProfile, userSubjects, schedulesToday, schedulesAll] = await Promise.all([
      getCurrentUserProfile(),
      getSubjects(),
      getTodaySchedules(),
      getAllSchedules(),
    ]);

    setProfile(userProfile);
    setSubjects(Array.isArray(userSubjects) ? userSubjects : []);
    setTodaySchedules(Array.isArray(schedulesToday) ? schedulesToday : []);
    setAllSchedules(Array.isArray(schedulesAll) ? schedulesAll : []);

    if (userProfile?.id) {
      getPredictions(userProfile.id).then(setPredictions).catch(err => console.warn('Predictions error:', err));
    }

    // Find next assessment across all subjects
    if (Array.isArray(userSubjects) && userSubjects.length > 0) {
      try {
        const allAssessments = await Promise.all(
          userSubjects.map((s: Subject) => getAssessments(s.id))
        );
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const upcoming = allAssessments.flat().filter((a: Assessment) => {
          if (a.is_completed || !a.date) return false;
          try {
            const [d, m, y] = a.date.split('-').map(Number);
            const taskDate = new Date(y, m - 1, d);
            return taskDate.getTime() >= today.getTime();
          } catch {
            return false;
          }
        });
        
        const sorted = upcoming.sort((a: any, b: any) => {
          try {
            const [da, ma, ya] = a.date.split('-').map(Number);
            const [db, mb, yb] = b.date.split('-').map(Number);
            if (ya && ma && da && yb && mb && db) {
              return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
            }
          } catch {}
          return 0;
        });
        setNextAssessment(sorted[0] || null);
      } catch (err) {
        console.warn('Error fetching next assessments:', err);
      }
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const fullName = useMemo(() => {
    const first = profile?.name?.trim() || '';
    const last = profile?.lastname?.trim() || '';
    return `${first} ${last}`.trim();
  }, [profile]);

  const nickname = useMemo(() => {
    return profile?.username?.trim() || fullName || '';
  }, [profile?.username, fullName]);

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
    return t('dashboard.gpaSummary', { gpa: '3.78', name: nameTag });
  }, [nickname, t]);

  const profileAvatarUri = useMemo(() => {
    const displayName = nickname || t('dashboard.defaultUser');
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=EDEEF2&color=111111&bold=true`;
  }, [nickname, t]);

  const shouldUseInfiniteCarousel = subjects.length > SUBJECT_LOOP_THRESHOLD;

  const carouselSubjects = useMemo(() => {
    if (!subjects.length) return [] as (Subject & { __key: string })[];

    if (!shouldUseInfiniteCarousel) {
      return subjects.map((subject) => ({
        ...subject,
        __key: `${subject.id}`,
      }));
    }

    const result: (Subject & { __key: string })[] = [];
    for (let loop = 0; loop < SUBJECT_LOOP_MULTIPLIER; loop += 1) {
      for (const subject of subjects) {
        result.push({
          ...subject,
          __key: `${subject.id}-${loop}`,
        });
      }
    }
    return result;
  }, [subjects, shouldUseInfiniteCarousel]);

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

  const resetSubjectForm = () => {
    setSubjectName('');
    setSubjectProfessor('');
    setSubjectTarget('');
    setSelectedColor(SUBJECT_COLORS[0]);
    setSelectedIcon('book-outline');
  };

  const handleSaveSubject = async () => {
    if (!subjectName.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.newSubject.errors.nameRequired'), type: 'warning' });
      return;
    }

    try {
      setIsSavingSubject(true);
      const created = await createSubject({
        name: subjectName.trim(),
        professor: subjectProfessor.trim() || undefined,
        color: selectedColor,
        icon: selectedIcon,
        target_grade: subjectTarget ? Number(subjectTarget) : undefined,
      });

      setSubjects((prev) => [...prev, { ...created, avg_score: 0, completion_percent: 0 }]);
      setIsSubjectModalVisible(false);
      resetSubjectForm();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.newSubject.errors.createFailed'), type: 'error' });
    } finally {
      setIsSavingSubject(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const buildScheduleKey = (day: number, startTime: string) => `${day}-${startTime}`;

  const selectedScheduleSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || null,
    [selectedSubjectId, subjects],
  );

  const existingScheduleRowsForSelectedSubject = useMemo(() => {
    if (!selectedSubjectId) return [] as any[];
    return allSchedules.filter((s) => s.subject_id === selectedSubjectId);
  }, [allSchedules, selectedSubjectId]);

  const existingScheduleKeysForSelectedSubject = useMemo(
    () =>
      new Set(
        existingScheduleRowsForSelectedSubject.map((s) =>
          buildScheduleKey(s.day_of_week, s.start_time),
        ),
      ),
    [existingScheduleRowsForSelectedSubject],
  );

  const scheduleHasChanges = useMemo(() => {
    if (scheduleDraftKeys.size !== existingScheduleKeysForSelectedSubject.size) return true;
    for (const key of scheduleDraftKeys) {
      if (!existingScheduleKeysForSelectedSubject.has(key)) return true;
    }
    return false;
  }, [existingScheduleKeysForSelectedSubject, scheduleDraftKeys]);

  useEffect(() => {
    if (!isScheduleModalVisible) {
      setScheduleDraftKeys(new Set());
      return;
    }

    if (!selectedSubjectId) {
      setScheduleDraftKeys(new Set());
      return;
    }

    setScheduleDraftKeys(new Set(existingScheduleKeysForSelectedSubject));
  }, [
    existingScheduleKeysForSelectedSubject,
    isScheduleModalVisible,
    selectedSubjectId,
  ]);

  const handleCloseSchedulePlanner = () => {
    Animated.timing(scheduleSheetAnim, {
      toValue: 500,
      duration: 280,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setIsScheduleModalVisible(false);
      setSelectedSubjectId(null);
      setScheduleDraftKeys(new Set());
    });
  };

  const handleOpenSchedulePlanner = () => {
    setSelectedSubjectId(null);
    setScheduleDraftKeys(new Set());
    setIsScheduleModalVisible(true);
  };

  const handleOpenQuickAdd = async () => {
    setIsQuickAddMenuVisible(true);
    try {
      const predicted = await getPredictedSubject();
      if (predicted) {
        setSelectedSubjectId(predicted.id);
      } else {
        setSelectedSubjectId(null);
      }
    } catch (e) {
      console.warn('Prediction error:', e);
    }
  };



  const handleToggleScheduleSlot = (day: number, hour: number) => {
    if (!selectedSubjectId) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.selectSubjectFirst'), type: 'warning' });
      return;
    }

    const startTime = `${hour.toString().padStart(2, '0')}:00`;

    setScheduleDraftKeys((prev) => {
      const next = new Set(prev);
      const key = buildScheduleKey(day, startTime);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSaveSchedule = async () => {
    if (!selectedSubjectId) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.selectSubjectFirst'), type: 'warning' });
      return;
    }

    if (!scheduleHasChanges) {
      showToast(t('dashboard.schedulePlanner.noChanges'));
      handleCloseSchedulePlanner();
      return;
    }

    const toDelete = existingScheduleRowsForSelectedSubject.filter(
      (s) => !scheduleDraftKeys.has(buildScheduleKey(s.day_of_week, s.start_time)),
    );

    const toCreate = Array.from(scheduleDraftKeys)
      .filter((key) => !existingScheduleKeysForSelectedSubject.has(key))
      .map((key) => {
        const [day, start] = key.split('-');
        const hour = Number(start.split(':')[0]);
        return {
          subject_id: selectedSubjectId,
          day_of_week: Number(day),
          start_time: start,
          end_time: `${(hour + 1).toString().padStart(2, '0')}:00`,
        };
      });

    try {
      setIsSavingSchedule(true);
      await Promise.all([
        ...toDelete.map((s) => deleteSchedule(s.id)),
        ...toCreate.map((payload) => createSchedule(payload)),
      ]);

      const [today, all] = await Promise.all([getTodaySchedules(), getAllSchedules()]);
      setTodaySchedules(today || []);
      setAllSchedules(all || []);
      showToast(t('dashboard.scheduleSuccess'));
      handleCloseSchedulePlanner();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.schedulePlanner.saveError'), type: 'error' });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!selectedSubjectId || !gradeName.trim() || !gradeValue.trim() || !gradePercentage.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.quickAddMenu.errors.fillFields'), type: 'warning' });
      return;
    }

    try {
      setIsSavingGrade(true);
      await createAssessment({
        subject_id: selectedSubjectId,
        name: gradeName.trim(),
        grade_value: Number(gradeValue),
        percentage: Number(gradePercentage),
        is_completed: true,
        type: 'grade',
      });

      const subjectName = subjects.find(s => s.id === selectedSubjectId)?.name || '';
      showToast(t('dashboard.quickAddMenu.grade.success', { subject: subjectName }));
      setIsGradeModalVisible(false);
      
      // Reset form
      setGradeName('');
      setGradeValue('');
      setGradePercentage('');
      setSelectedSubjectId(null);
      
      // Refresh subjects to update averages
      const userSubjects = await getSubjects();
      setSubjects(userSubjects || []);
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.quickAddMenu.grade.errorSave'), type: 'error' });
    } finally {
      setIsSavingGrade(false);
    }
  };

  const handleTakePhoto = () => {
    setIsQuickAddMenuVisible(false);
    setIsPhotoModalVisible(true);
  };

  const handleSaveTask = async () => {
    if (!selectedSubjectId || !taskName.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.quickAddMenu.errors.fillFields'), type: 'warning' });
      return;
    }

    try {
      setIsSavingTask(true);
      await createAssessment({
        subject_id: selectedSubjectId,
        name: taskName.trim(),
        date: taskDate,
        is_completed: false,
        type: 'task',
      });

      showToast(t('dashboard.quickAddMenu.task.success'));
      setIsTaskModalVisible(false);
      setTaskName('');
      setSelectedSubjectId(null);
      
      // Refresh next assessment
      loadData();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.quickAddMenu.task.errorSave'), type: 'error' });
    } finally {
      setIsSavingTask(false);
    }
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const d = selectedDate.getDate().toString().padStart(2, '0');
      const m = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
      const y = selectedDate.getFullYear();
      setTaskDate(`${d}-${m}-${y}`);
    }
  };

  // ----- SUB-COMPONENTS -----
  const SubjectTile = ({ subject }: { subject: Subject }) => {
    const avg = typeof subject.avg_score === 'number' ? subject.avg_score : 0;
    const completion = typeof subject.completion_percent === 'number' ? subject.completion_percent : 0;

    return (
      <TouchableOpacity 
        style={styles.subjectTile} 
        activeOpacity={0.7}
        onPress={() => router.push(`/subjects/${subject.id}`)}
      >
        <View style={[styles.subjectBadge, { backgroundColor: subject.color || '#CCCCCC' }]}>
          <MaterialCommunityIcons name={(subject.icon as any) || 'book-outline'} size={20} color={theme.colors.text.primary} />
        </View>
        <View style={globalStyles.flex1}>
          <Text style={styles.subjectTileName} numberOfLines={1}>{subject.name}</Text>
          <Text style={styles.subjectTileMeta} numberOfLines={1}>
            {subject.professor || t('dashboard.newSubject.noProfessor')}
          </Text>
          <Text style={styles.subjectTileStats}>{t('dashboard.subjectCardAvg', { avg: avg.toFixed(1) })}</Text>
          <Text style={styles.subjectTileStats}>{t('dashboard.subjectCardCompletion', { completion: completion.toFixed(0) })}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const MetricCard = ({ title, value, subtext, icon, color, showMood, onPress }: any) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (showMood) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { 
              toValue: 1.15, 
              duration: 150, 
              easing: Easing.out(Easing.ease),
              useNativeDriver: true 
            }),
            Animated.timing(pulseAnim, { 
              toValue: 1, 
              duration: 1000, 
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true 
            }),
          ])
        ).start();
      } else {
        pulseAnim.setValue(1);
      }
    }, [showMood, pulseAnim]);

    return (
      <TouchableOpacity 
        style={styles.metricCard} 
        activeOpacity={0.7}
        onPress={onPress || (() => setSelectedMetric({ title, value, subtext, icon, color }))}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Animated.View style={[
            styles.iconBox, 
            { backgroundColor: color + '20' },
            showMood && { transform: [{ scale: pulseAnim }] }
          ]}>
            <Ionicons name={icon} size={20} color={color} />
          </Animated.View>
        </View>
        <Text 
          style={styles.cardValue} 
          numberOfLines={1} 
          adjustsFontSizeToFit 
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        <Text style={styles.cardSubtext} numberOfLines={1}>{subtext}</Text>
      </TouchableOpacity>
    );
  };

  const ActionCircle = ({ title, icon, color, onPress }: any) => (
    <TouchableOpacity style={styles.actionItem} activeOpacity={0.65} onPress={onPress}>
      <View style={[styles.actionCircle, { backgroundColor: color + '08', borderColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  );

  const PerformanceRow = ({ rank, name, gpa, icon, iconColor, isYou }: any) => (
    <View style={[styles.perfRow, isYou && styles.perfRowYou]}>
      <Text style={styles.perfRank}>#{rank}</Text>
      <View style={styles.perfUser}>
        <Ionicons name={icon} size={20} color={iconColor} style={globalStyles.mr8} />
        <Text style={[styles.perfName, isYou && { fontWeight: '600' }]}>{name}</Text>
      </View>
      <Text style={styles.perfGpa}>{t('dashboard.gpa')} {gpa}</Text>
    </View>
  );

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* 1. HEADER */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
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
            </View>
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
              renderItem={({ item }) => <SubjectTile subject={item} />}
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
            <View style={styles.nextClassInfo}>
              <View style={styles.nextClassBadge}>
                <Ionicons name="time-outline" size={24} color={theme.colors.primary} />
              </View>
              <View style={globalStyles.flex1}>
                {nextClass ? (
                  <>
                    <Text style={styles.nextClassTitle} numberOfLines={1}>{nextClass.name}</Text>
                    <Text style={styles.nextClassRoom}>
                      {nextClass.start_time} - {nextClass.end_time}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.nextClassTitle} numberOfLines={1}>{todaySchedules.length > 0 ? "¡Terminaste por hoy!" : t('dashboard.noClasses')}</Text>
                    <Text style={styles.nextClassRoom}>{t('dashboard.enjoyDay')}</Text>
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

          {predictions && predictions.dueCount > 0 ? (
            <View style={{ marginTop: 24 }}>
              <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('dashboard.urgentReviews', 'Repasos Urgentes')}</Text>
                <View style={[styles.allChip, { backgroundColor: '#FF3B3020' }]}>
                  <Text style={[styles.allChipText, { color: '#FF3B30', fontWeight: 'bold' }]}>{predictions.dueCount}</Text>
                </View>
              </View>
              <View style={[styles.nextClassCard, { borderColor: '#FF3B3030', borderWidth: 1, backgroundColor: '#FF3B3005' }]}>
                <View style={styles.nextClassInfo}>
                  <View style={[styles.nextClassBadge, { backgroundColor: '#FF3B3020' }]}>
                    <MaterialCommunityIcons name="brain" size={24} color="#FF3B30" />
                  </View>
                  <View style={globalStyles.flex1}>
                    <Text style={styles.nextClassTitle} numberOfLines={1}>{t('dashboard.attentionRequired', 'Atención Requerida')}</Text>
                    <Text style={[styles.nextClassRoom, { color: theme.colors.text.secondary }]}>
                      {t('dashboard.cardsToForget', 'Tienes tarjetas a punto de ser olvidadas.')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.openBtn, { backgroundColor: '#FF3B30' }]}
                  onPress={() => setIsFlashcardsVisible(true)}
                >
                  <Text style={[styles.openBtnText, { color: '#fff' }]}>{t('dashboard.reviewBtn', 'Repasar')}</Text>
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
              onPress={handleOpenSchedulePlanner}
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
                  value={nextAssessment ? nextAssessment.name : "Nada pendiente"} 
                  subtext={nextAssessment ? nextAssessment.date : "Tómate un descanso"} 
                  icon="document-text-outline" 
                  color={mood.color}
                  showMood={mood.show}
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

        <Modal
          visible={isSubjectModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsSubjectModalVisible(false)}
        >
          <Pressable style={styles.sheetBackdrop} onPress={() => setIsSubjectModalVisible(false)}>
            <Pressable style={styles.sheetContent} onPress={() => null}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{t('dashboard.newSubject.title')}</Text>
              <Text style={styles.sheetSubtitle}>{t('dashboard.newSubject.subtitle')}</Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
                <Text style={styles.sheetLabel}>{t('dashboard.newSubject.name')}</Text>
                <TextInput
                  value={subjectName}
                  onChangeText={setSubjectName}
                  style={styles.sheetInput}
                  placeholder={t('dashboard.newSubject.namePlaceholder')}
                  placeholderTextColor={theme.colors.text.placeholder}
                />

                <Text style={styles.sheetLabel}>{t('dashboard.newSubject.professor')}</Text>
                <TextInput
                  value={subjectProfessor}
                  onChangeText={setSubjectProfessor}
                  style={styles.sheetInput}
                  placeholder={t('dashboard.newSubject.professorPlaceholder')}
                  placeholderTextColor={theme.colors.text.placeholder}
                />

                <Text style={styles.sheetLabel}>{t('dashboard.newSubject.targetGrade')}</Text>
                <TextInput
                  value={subjectTarget}
                  onChangeText={setSubjectTarget}
                  style={styles.sheetInput}
                  keyboardType="numeric"
                  placeholder={t('dashboard.newSubject.targetGradePlaceholder')}
                  placeholderTextColor={theme.colors.text.placeholder}
                />

                <Text style={styles.sheetLabel}>{t('dashboard.newSubject.color')}</Text>
                <View style={styles.optionsRow}>
                  {SUBJECT_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        selectedColor === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setSelectedColor(color)}
                    />
                  ))}
                </View>

                <Text style={styles.sheetLabel}>{t('dashboard.newSubject.icon')}</Text>
                <View style={styles.optionsRow}>
                  {SUBJECT_ICONS.map((iconName) => (
                    <TouchableOpacity
                      key={iconName}
                      style={[styles.iconOption, selectedIcon === iconName && styles.iconOptionSelected]}
                      onPress={() => setSelectedIcon(iconName)}
                    >
                      <MaterialCommunityIcons name={iconName} size={18} color={theme.colors.text.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.sheetActions}>
                <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={() => setIsSubjectModalVisible(false)}>
                  <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetSaveBtn, { flex: 1 }, isSavingSubject && { opacity: 0.6 }]}
                  onPress={handleSaveSubject}
                  disabled={isSavingSubject}
                >
                  <Text style={styles.sheetSaveText}>
                    {isSavingSubject ? t('dashboard.newSubject.saving') : t('dashboard.newSubject.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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

      {/* REGISTRAR CALIFICACIÓN MODAL */}
      <Modal
        visible={isGradeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsGradeModalVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setIsGradeModalVisible(false)}>
          <Pressable style={styles.sheetContent} onPress={() => null}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('dashboard.quickAddMenu.grade.title')}</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.subject')}</Text>
              <TouchableOpacity 
                style={styles.dropdownSelector} 
                onPress={() => setIsSubjectSelectorVisible(true)}
              >
                <Text style={[
                  styles.dropdownSelectorText, 
                  !selectedSubjectId && styles.dropdownPlaceholder
                ]}>
                  {selectedSubjectId 
                    ? subjects.find(s => s.id === selectedSubjectId)?.name 
                    : t('dashboard.quickAddMenu.grade.subjectPlaceholder')}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.text.placeholder} />
              </TouchableOpacity>

              <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.name')}</Text>
              <TextInput
                value={gradeName}
                onChangeText={setGradeName}
                style={styles.sheetInput}
                placeholder={t('dashboard.quickAddMenu.grade.namePlaceholder')}
                placeholderTextColor={theme.colors.text.placeholder}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={globalStyles.flex1}>
                  <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.grade')}</Text>
                  <TextInput
                    value={gradeValue}
                    onChangeText={setGradeValue}
                    style={styles.sheetInput}
                    keyboardType="numeric"
                    placeholder={t('dashboard.quickAddMenu.grade.gradePlaceholder')}
                    placeholderTextColor={theme.colors.text.placeholder}
                  />
                </View>
                <View style={globalStyles.flex1}>
                  <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.percentage')}</Text>
                  <TextInput
                    value={gradePercentage}
                    onChangeText={setGradePercentage}
                    style={styles.sheetInput}
                    keyboardType="numeric"
                    placeholder={t('dashboard.quickAddMenu.grade.percentagePlaceholder')}
                    placeholderTextColor={theme.colors.text.placeholder}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={() => setIsGradeModalVisible(false)}>
                <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSaveBtn, { flex: 1 }, isSavingGrade && { opacity: 0.6 }]}
                onPress={handleSaveGrade}
                disabled={isSavingGrade}
              >
                <Text style={styles.sheetSaveText}>
                  {isSavingGrade ? t('dashboard.newSubject.saving') : t('dashboard.quickAddMenu.grade.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* NUEVA TAREA MODAL */}
      <Modal
        visible={isTaskModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsTaskModalVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setIsTaskModalVisible(false)}>
          <Pressable style={styles.sheetContent} onPress={() => null}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('dashboard.quickAddMenu.task.title')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.subject')}</Text>
              <TouchableOpacity 
                style={styles.dropdownSelector} 
                onPress={() => setIsSubjectSelectorVisible(true)}
              >
                <Text style={[
                  styles.dropdownSelectorText, 
                  !selectedSubjectId && styles.dropdownPlaceholder
                ]}>
                  {selectedSubjectId 
                    ? subjects.find(s => s.id === selectedSubjectId)?.name 
                    : t('dashboard.quickAddMenu.grade.subjectPlaceholder')}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.text.placeholder} />
              </TouchableOpacity>

              <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.task.name')}</Text>
              <TextInput
                value={taskName}
                onChangeText={setTaskName}
                style={styles.sheetInput}
                placeholder={t('dashboard.quickAddMenu.task.namePlaceholder')}
                placeholderTextColor={theme.colors.text.placeholder}
              />

              <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.task.date')}</Text>
              <Pressable 
                style={[styles.dropdownSelector, { paddingVertical: 0 }]}
                onPress={() => setShowDatePicker(true)}
              >
                <TextInput
                  value={taskDate}
                  onChangeText={setTaskDate}
                  style={[styles.sheetInput, { borderWidth: 0, flex: 1, backgroundColor: 'transparent', paddingHorizontal: 0 }]}
                  placeholder={t('dashboard.quickAddMenu.task.dateFormat')}
                  placeholderTextColor={theme.colors.text.placeholder}
                  editable={true}
                />
                <Ionicons name="calendar-outline" size={20} color={theme.colors.text.placeholder} />

                {showDatePicker ? (
                  <ThresholdDatePicker
                    value={(() => {
                      try {
                        const [d, m, y] = taskDate.split('-').map(Number);
                        return new Date(y, m - 1, d);
                      } catch {
                        return new Date();
                      }
                    })()}
                    mode="date"
                    onChange={onDateChange}
                  />
                ) : null}
              </Pressable>
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={() => setIsTaskModalVisible(false)}>
                <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSaveBtn, { flex: 1 }, isSavingTask && { opacity: 0.6 }]}
                onPress={handleSaveTask}
                disabled={isSavingTask}
              >
                <Text style={styles.sheetSaveText}>
                  {isSavingTask ? t('dashboard.newSubject.saving') : t('dashboard.quickAddMenu.task.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* GESTIONAR HORARIO MODAL (GRILLA SEMANAL) */}
      <Modal
        visible={isScheduleModalVisible}
        animationType="none"
        transparent
        onRequestClose={handleCloseSchedulePlanner}
        onShow={() => {
          scheduleSheetAnim.setValue(500);
          Animated.spring(scheduleSheetAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 14,
          }).start();
        }}
      >
        <Pressable style={styles.sheetBackdrop} onPress={handleCloseSchedulePlanner}>
          <Animated.View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom + 8, 20), transform: [{ translateY: scheduleSheetAnim }] }]}>
            <View style={styles.sheetHandle} />

            {/* Title row with X close button */}
            <View style={[globalStyles.rowBetweenCenter, { marginBottom: 14 }]}>
              <Text style={styles.sheetTitle}>{t('dashboard.weeklySchedule')}</Text>
              <TouchableOpacity
                onPress={handleCloseSchedulePlanner}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Full-width subject dropdown */}
            <TouchableOpacity 
              style={[styles.dropdownSelector, { marginBottom: 12 }]} 
              onPress={() => setIsSubjectSelectorVisible(true)}
            >
              <View style={[globalStyles.rowCenter, globalStyles.flex1]}>
                {selectedSubjectId ? (
                  <View style={[styles.dot, { backgroundColor: subjects.find(s => s.id === selectedSubjectId)?.color || theme.colors.primary, marginRight: 8 }]} />
                ) : null}
                <Text style={[styles.dropdownSelectorText, !selectedSubjectId && styles.dropdownPlaceholder, { flex: 1 }]} numberOfLines={1}>
                  {selectedSubjectId 
                    ? subjects.find(s => s.id === selectedSubjectId)?.name 
                    : t('dashboard.quickAddMenu.grade.subjectPlaceholder')}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={theme.colors.text.placeholder} />
            </TouchableOpacity>

            {!selectedSubjectId ? (
              <Text style={styles.scheduleHintText}>{t('dashboard.schedulePlanner.selectSubjectHint')}</Text>
            ) : scheduleDraftKeys.size === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, backgroundColor: theme.colors.inputBackground, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.colors.border }}>
                <Ionicons name="calendar-outline" size={13} color={theme.colors.text.secondary} />
                <Text style={{ fontSize: 12, color: theme.colors.text.secondary, fontWeight: '500' }}>{t('dashboard.noScheduleAssigned')}</Text>
              </View>
            ) : (
              <View style={{ height: styles.scheduleHintText.fontSize ? styles.scheduleHintText.fontSize * 1.5 : 20 }} />
            )}

            <View style={[styles.gridContainer, { height: 400, flexShrink: 1 }]}>
              {/* Header: Days */}
              <View style={styles.gridHeader}>
                <View style={styles.hourColHeader} />
                {(Array.isArray(t('common.daysShort', { returnObjects: true })) 
                  ? (t('common.daysShort', { returnObjects: true }) as string[])
                  : ['L', 'M', 'X', 'J', 'V', 'S', 'D']
                ).map((d, i) => (
                  <View key={`${d}-${i}`} style={styles.dayColHeader}>
                    <Text style={styles.dayHeaderText}>{d}</Text>
                  </View>
                ))}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => (
                  <View key={hour} style={styles.gridRow}>
                    <View style={styles.hourCol}>
                      <Text style={styles.hourText}>{`${hour}:00`}</Text>
                    </View>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const startTime = `${hour.toString().padStart(2, '0')}:00`;
                      const key = buildScheduleKey(day, startTime);

                      const isActive = selectedSubjectId
                        ? scheduleDraftKeys.has(key)
                        : allSchedules.some(s => buildScheduleKey(s.day_of_week, s.start_time) === key);

                      const matchingEntry = !selectedSubjectId
                        ? allSchedules.find(s => buildScheduleKey(s.day_of_week, s.start_time) === key)
                        : null;
                      const slotColor = selectedSubjectId
                        ? (selectedScheduleSubject?.color || theme.colors.primary)
                        : (subjects.find(s => s.id === matchingEntry?.subject_id)?.color || theme.colors.primary);

                      return (
                        <TouchableOpacity 
                          key={`${day}-${hour}`} 
                          style={styles.gridCell}
                          onPress={() => {
                            if (!selectedSubjectId) {
                              setIsSubjectSelectorVisible(true);
                              return;
                            }
                            handleToggleScheduleSlot(day, hour);
                          }}
                        >
                          {isActive ? (
                            <View style={[styles.slotIndicator, { backgroundColor: slotColor }]} />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>

            <View style={[styles.sheetActions, { marginTop: 16 }]}> 
              <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleCloseSchedulePlanner}>
                <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sheetSaveBtn,
                  { flex: 1 },
                  (!selectedSubjectId || isSavingSchedule) && { opacity: 0.55 },
                ]}
                onPress={handleSaveSchedule}
                disabled={!selectedSubjectId || isSavingSchedule}
              >
                <Text style={styles.sheetSaveText}>
                  {isSavingSchedule ? t('dashboard.newSubject.saving') : t('dashboard.schedulePlanner.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* SUBJECT SELECTOR MODAL */}
      <Modal
        visible={isSubjectSelectorVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsSubjectSelectorVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setIsSubjectSelectorVisible(false)}>
          <View style={[styles.sheetContent, { maxHeight: '60%' }]}>
            <Text style={[styles.sheetTitle, { marginBottom: 16 }]}>{t('dashboard.quickAddMenu.grade.subjectPlaceholder')}</Text>
            <FlatList
              data={subjects}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.quickAddMenuItem, 
                    { marginBottom: 12, padding: 16 },
                    selectedSubjectId === item.id && { borderColor: theme.colors.primary, borderWidth: 2 }
                  ]}
                  onPress={() => {
                    setSelectedSubjectId(item.id);
                    setIsSubjectSelectorVisible(false);
                  }}
                >
                  <View style={[styles.subjectBadge, { backgroundColor: item.color || '#CCCCCC', marginBottom: 0, marginRight: 16, width: 44, height: 44, borderRadius: 12 }]}>
                    <MaterialCommunityIcons name={(item.icon as any) || 'book-outline'} size={22} color={theme.colors.text.primary} />
                  </View>
                  <View style={styles.quickAddMenuInfo}>
                    <Text style={styles.quickAddMenuText}>{item.name}</Text>
                    <Text style={styles.quickAddMenuSubtext}>{item.professor || t('dashboard.newSubject.noProfessor')}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setIsSubjectSelectorVisible(false)}>
              <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      
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
      {/* FAB - BOTÓN MAESTRO */}
              <TouchableOpacity 
        style={styles.fab} 
        onPress={handleOpenQuickAdd}
      >
        <Ionicons name="add" size={32} color={theme.colors.white} />
      </TouchableOpacity>

      <React.Suspense fallback={null}>
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
                  subject_id: lastSessionSubjectId,
                  session_type: lastSessionMode === 'pomodoro' ? 'Pomodoro' : 'Threshold',
                  duration_seconds: lastSessionDuration,
                  performance_rating: rating,
                });
                showToast(t('common.success') + ': Progreso guardado');
              } catch {
                showToast('Error al guardar sesión de estudio');
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

        {isFlashcardsVisible && (
          <FlashcardsModal
            isVisible={isFlashcardsVisible}
            onClose={() => setIsFlashcardsVisible(false)}
            subjects={subjects}
          />
        )}
      </React.Suspense>
    </>
  );
}
