import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, ScrollView, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { alertRef } from '../ui/CustomAlert';
import { createSchedule, deleteSchedule, type Subject } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { SubjectSelectorModal } from './SubjectSelectorModal';

interface SchedulePlannerModalProps {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  allSchedules: any[];
  onScheduleUpdated: () => void;
}

export const SchedulePlannerModal = ({ visible, onClose, subjects, allSchedules, onScheduleUpdated }: SchedulePlannerModalProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { refreshSchedules } = useDataStore();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isSubjectSelectorVisible, setIsSubjectSelectorVisible] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleDraftKeys, setScheduleDraftKeys] = useState<Set<string>>(new Set());
  const scheduleSheetAnim = useRef(new Animated.Value(500)).current;

  const buildScheduleKey = (day: number, startTime: string) => `${day}-${startTime}`;

  const selectedScheduleSubject = useMemo(
    () => Array.isArray(subjects) ? subjects.find((s) => s.id === selectedSubjectId) || null : null,
    [selectedSubjectId, subjects],
  );

  const existingScheduleRowsForSelectedSubject = useMemo(() => {
    if (!selectedSubjectId) return [] as any[];
    return Array.isArray(allSchedules) ? allSchedules.filter((s) => s.subject_id === selectedSubjectId) : [];
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
    if (!visible) {
      setScheduleDraftKeys(new Set());
      return;
    }
    if (!selectedSubjectId) {
      setScheduleDraftKeys(new Set());
      return;
    }
    setScheduleDraftKeys(new Set(existingScheduleKeysForSelectedSubject));
  }, [existingScheduleKeysForSelectedSubject, visible, selectedSubjectId]);

  const handleCloseSchedulePlanner = () => {
    Animated.timing(scheduleSheetAnim, {
      toValue: 500,
      duration: 280,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      onClose();
      setSelectedSubjectId(null);
      setScheduleDraftKeys(new Set());
    });
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
      alertRef.show({ title: 'Info', message: t('dashboard.schedulePlanner.noChanges'), type: 'success' });
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

      await refreshSchedules();
      onScheduleUpdated();
      alertRef.show({ title: t('common.success'), message: t('dashboard.scheduleSuccess'), type: 'success' });
      handleCloseSchedulePlanner();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.schedulePlanner.saveError'), type: 'error' });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
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
          <Animated.View
            style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom + 8, 20), transform: [{ translateY: scheduleSheetAnim }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>

            <View style={styles.sheetHandle} />

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

            <TouchableOpacity 
              style={[styles.dropdownSelector, { marginBottom: 12 }]} 
              onPress={() => setIsSubjectSelectorVisible(true)}
            >
              <View style={[globalStyles.rowCenter, globalStyles.flex1]}>
                {selectedSubjectId ? (
                  <View style={[styles.dot, { backgroundColor: Array.isArray(subjects) ? (subjects.find(s => s.id === selectedSubjectId)?.color || theme.colors.primary) : theme.colors.primary, marginRight: 8 }]} />
                ) : null}
                <Text style={[styles.dropdownSelectorText, !selectedSubjectId && styles.dropdownPlaceholder, { flex: 1 }]} numberOfLines={1}>
                  {selectedSubjectId 
                    ? Array.isArray(subjects) ? subjects.find(s => s.id === selectedSubjectId)?.name : undefined
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
                        : Array.isArray(allSchedules) && allSchedules.some(s => buildScheduleKey(s.day_of_week, s.start_time) === key);

                      const matchingEntry = !selectedSubjectId
                        ? Array.isArray(allSchedules) ? allSchedules.find(s => buildScheduleKey(s.day_of_week, s.start_time) === key) : null
                        : null;
                      const slotColor = selectedSubjectId
                        ? (selectedScheduleSubject?.color || theme.colors.primary)
                        : (Array.isArray(subjects) ? subjects.find(s => s.id === matchingEntry?.subject_id)?.color : undefined) || theme.colors.primary;

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
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
      
      <SubjectSelectorModal
        visible={isSubjectSelectorVisible}
        subjects={subjects}
        selectedSubjectId={selectedSubjectId}
        onSelectSubject={setSelectedSubjectId}
        onClose={() => setIsSubjectSelectorVisible(false)}
      />
    </>
  );
};
