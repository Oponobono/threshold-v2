import React from 'react';
import { Animated, FlatList, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { Subject } from '../../services/api/types';

interface SchedulePlannerProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  subjects: Subject[];
  selectedSubjectId: number | null;
  onOpenSubjectSelector: () => void;
  scheduleDraftKeys: Set<string>;
  allSchedules: any[];
  isSaving: boolean;
  buildScheduleKey: (day: number, startTime: string) => string;
  onToggleSlot: (day: number, hour: number) => void;
  scheduleSheetAnim: Animated.Value;
}

export const SchedulePlannerModal = React.memo(({
  visible, onClose, onSave,
  subjects, selectedSubjectId, onOpenSubjectSelector,
  scheduleDraftKeys, allSchedules,
  isSaving,
  buildScheduleKey, onToggleSlot,
  scheduleSheetAnim,
}: SchedulePlannerProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const selectedScheduleSubject = subjects.find(s => s.id === selectedSubjectId) || null;

  if (!visible) return null;

  return (
    <Modal
      visible
      animationType="none"
      transparent
      onRequestClose={onClose}
      onShow={() => {
        scheduleSheetAnim.setValue(500);
        Animated.spring(scheduleSheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 14 }).start();
      }}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Animated.View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom + 8, 20), transform: [{ translateY: scheduleSheetAnim }] }]}>
          <View style={styles.sheetHandle} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={styles.sheetTitle}>{t('dashboard.weeklySchedule')}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={18} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.dropdownSelector, { marginBottom: 12 }]} onPress={onOpenSubjectSelector}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {selectedSubjectId ? (
                <View style={[styles.dot, { backgroundColor: subjects.find(s => s.id === selectedSubjectId)?.color || theme.colors.primary, marginRight: 8 }]} />
              ) : null}
              <Text style={[styles.dropdownSelectorText, !selectedSubjectId && styles.dropdownPlaceholder, { flex: 1 }]} numberOfLines={1}>
                {selectedSubjectId ? subjects.find(s => s.id === selectedSubjectId)?.name : t('dashboard.quickAddMenu.grade.subjectPlaceholder')}
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
                          if (!selectedSubjectId) { onOpenSubjectSelector(); return; }
                          onToggleSlot(day, hour);
                        }}
                      >
                        {isActive ? <View style={[styles.slotIndicator, { backgroundColor: slotColor }]} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>

          <View style={[styles.sheetActions, { marginTop: 16 }]}>
            <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={onClose}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetSaveBtn, { flex: 1 }, (!selectedSubjectId || isSaving) && { opacity: 0.55 }]}
              onPress={onSave}
              disabled={!selectedSubjectId || isSaving}
            >
              <Text style={styles.sheetSaveText}>
                {isSaving ? t('dashboard.newSubject.saving') : t('dashboard.schedulePlanner.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});
SchedulePlannerModal.displayName = 'SchedulePlannerModal';

// ─── Subject Selector Modal ───────────────────────────────────────────────────
interface SubjectSelectorProps {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  selectedSubjectId: number | null;
  onSelect: (id: number) => void;
}

export const SubjectSelectorModal = React.memo(({ visible, onClose, subjects, selectedSubjectId, onSelect }: SubjectSelectorProps) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={[styles.sheetContent, { maxHeight: '60%' }]}>
          <Text style={[styles.sheetTitle, { marginBottom: 16 }]}>{t('dashboard.quickAddMenu.grade.subjectPlaceholder')}</Text>
          <FlatList
            data={subjects}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.quickAddMenuItem, { marginBottom: 12, padding: 16 }, selectedSubjectId === item.id && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                onPress={() => { onSelect(item.id); onClose(); }}
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
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose}>
            <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
});
SubjectSelectorModal.displayName = 'SubjectSelectorModal';
