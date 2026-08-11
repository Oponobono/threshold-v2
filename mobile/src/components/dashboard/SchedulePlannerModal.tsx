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

  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    subjectName: string;
    timeStr: string;
    color: string;
  } | null>(null);

  const daysShort = useMemo(() => {
    const raw = t('common.daysShort', { returnObjects: true });
    return Array.isArray(raw) ? raw as string[] : ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  }, [t]);

  const assignedSubjectIds = useMemo(() => {
    if (!Array.isArray(allSchedules)) return [];
    const ids = new Set(allSchedules.map(s => s.subject_id));
    return Array.from(ids);
  }, [allSchedules]);

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
                {daysShort.map((d, i) => (
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
                          onPress={(e) => {
                            if (!selectedSubjectId) {
                              if (matchingEntry) {
                                // Show tooltip if pressing an assigned slot and no subject is currently being edited
                                const matchingSubject = Array.isArray(subjects) ? subjects.find(s => s.id === matchingEntry.subject_id) : null;
                                if (matchingSubject) {
                                  setActiveTooltip({
                                    x: e.nativeEvent.pageX,
                                    y: e.nativeEvent.pageY,
                                    subjectName: matchingSubject.name,
                                    timeStr: `${daysShort[day - 1]} ${hour}:00 - ${hour + 1}:00`,
                                    color: matchingSubject.color || theme.colors.primary,
                                  });
                                  setTimeout(() => setActiveTooltip(null), 2500);
                                }
                                return;
                              }
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

          {activeTooltip && (
            <View 
              style={{
                position: 'absolute',
                top: activeTooltip.y - 70, // 70px above the touch point
                left: Math.min(Math.max(activeTooltip.x - 100, 20), 1000), // Approximate centering
                backgroundColor: theme.colors.card,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
                zIndex: 9999,
                minWidth: 200,
              }}
              pointerEvents="none"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: activeTooltip.color, marginRight: 8 }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary }} numberOfLines={1}>
                  {activeTooltip.subjectName}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 18 }}>
                <Ionicons name="time-outline" size={12} color={theme.colors.text.secondary} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>
                  {activeTooltip.timeStr}
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
      <SubjectSelectorModal
        visible={isSubjectSelectorVisible}
        subjects={subjects}
        assignedSubjectIds={assignedSubjectIds}
        selectedSubjectId={selectedSubjectId}
        onSelectSubject={setSelectedSubjectId}
        onClose={() => setIsSubjectSelectorVisible(false)}
      />
    </>
  );
};
