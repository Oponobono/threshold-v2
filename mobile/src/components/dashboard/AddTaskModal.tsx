import React from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { ThresholdDatePicker } from '../ThresholdDatePicker';
import { Subject } from '../../services/api/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  subjects: Subject[];
  selectedSubjectId: number | null;
  onOpenSubjectSelector: () => void;
  taskName: string;
  setTaskName: (v: string) => void;
  taskDate: string;
  setTaskDate: (v: string) => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  onDateChange: (event: any, date?: Date) => void;
  isSaving: boolean;
}

export const AddTaskModal = React.memo(({
  visible, onClose, onSave,
  subjects, selectedSubjectId, onOpenSubjectSelector,
  taskName, setTaskName,
  taskDate, setTaskDate,
  showDatePicker, setShowDatePicker,
  onDateChange,
  isSaving,
}: Props) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('dashboard.quickAddMenu.task.title')}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
            <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.subject')}</Text>
            <TouchableOpacity style={styles.dropdownSelector} onPress={onOpenSubjectSelector}>
              <Text style={[styles.dropdownSelectorText, !selectedSubjectId && styles.dropdownPlaceholder]}>
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
                editable
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
            <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={onClose}>
              <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetSaveBtn, { flex: 1 }, isSaving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={isSaving}
            >
              <Text style={styles.sheetSaveText}>
                {isSaving ? t('dashboard.newSubject.saving') : t('dashboard.quickAddMenu.task.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
AddTaskModal.displayName = 'AddTaskModal';
