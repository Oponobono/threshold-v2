import { useState, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { alertRef } from '../components/CustomAlert';
import { createSchedule, deleteSchedule, getTodaySchedules } from '../services/api';
import { type Schedule } from '../services/api';
import { useDataStore } from '../store/useDataStore';
import { useTranslation } from 'react-i18next';

export function useScheduleManager(selectedSubjectId: number | null, setTodaySchedules: (s: any[]) => void) {
  const { t } = useTranslation();
  const { schedules: allSchedules, refreshSchedules } = useDataStore();

  const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleDraftKeys, setScheduleDraftKeys] = useState<Set<string>>(new Set<string>());
  const scheduleSheetAnim = useRef(new Animated.Value(500)).current;

  const buildScheduleKey = (day: number, startTime: string) => `${day}-${startTime}`;

  const existingScheduleRowsForSelectedSubject = useMemo(() => {
    if (!selectedSubjectId) return [] as Schedule[];
    return allSchedules.filter((s) => s.subject_id === selectedSubjectId);
  }, [allSchedules, selectedSubjectId]);

  const existingScheduleKeysForSelectedSubject = useMemo(
    () => new Set(existingScheduleRowsForSelectedSubject.map((s: any) => buildScheduleKey(s.day_of_week, s.start_time))),
    [existingScheduleRowsForSelectedSubject]
  );

  const scheduleHasChanges = useMemo(() => {
    if (scheduleDraftKeys.size !== existingScheduleKeysForSelectedSubject.size) return true;
    for (const key of scheduleDraftKeys) {
      if (!existingScheduleKeysForSelectedSubject.has(key)) return true;
    }
    return false;
  }, [existingScheduleKeysForSelectedSubject, scheduleDraftKeys]);

  useEffect(() => {
    if (!isScheduleModalVisible || !selectedSubjectId) {
      setScheduleDraftKeys(new Set<string>());
      return;
    }
    setScheduleDraftKeys(new Set(existingScheduleKeysForSelectedSubject));
  }, [existingScheduleKeysForSelectedSubject, isScheduleModalVisible, selectedSubjectId]);

  const handleCloseSchedulePlanner = () => {
    Animated.timing(scheduleSheetAnim, {
      toValue: 500, duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true,
    }).start(() => {
      setIsScheduleModalVisible(false);
      setScheduleDraftKeys(new Set<string>());
    });
  };

  const handleOpenSchedulePlanner = () => {
    setScheduleDraftKeys(new Set<string>());
    setIsScheduleModalVisible(true);
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
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const handleSaveSchedule = async (showToast: (msg: string) => void) => {
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
      (s: any) => !scheduleDraftKeys.has(buildScheduleKey(s.day_of_week, s.start_time))
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
      await refreshSchedules();
      const today = await getTodaySchedules();
      setTodaySchedules(today || []);
      showToast(t('dashboard.scheduleSuccess'));
      handleCloseSchedulePlanner();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.schedulePlanner.saveError'), type: 'error' });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  return {
    allSchedules, isScheduleModalVisible, isSavingSchedule, scheduleDraftKeys,
    scheduleSheetAnim, buildScheduleKey, handleCloseSchedulePlanner,
    handleOpenSchedulePlanner, handleToggleScheduleSlot, handleSaveSchedule,
  };
}
