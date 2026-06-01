import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { alertRef } from '../ui/CustomAlert';
import { createAssessment, type Subject } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import { ThresholdDatePicker } from '../ui/ThresholdDatePicker';
import { SubjectSelectorModal } from './SubjectSelectorModal';
import { CategorySelectorModal } from './CategorySelectorModal';
import { getCategoriesBySubject, type AssessmentCategory } from '../../services/api/assessmentCategories';

interface CreateTaskModalProps {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectId?: number | null;
  onTaskCreated: () => Promise<void> | void;
}

export const CreateTaskModal = ({ visible, onClose, subjects, initialSubjectId, onTaskCreated }: CreateTaskModalProps) => {
  const { t } = useTranslation();
  const isOnline = useConnectivityStore(s => s.isOnline);

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(initialSubjectId || null);
  const [isSubjectSelectorVisible, setIsSubjectSelectorVisible] = useState(false);
  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isCategorySelectorVisible, setIsCategorySelectorVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [taskDate, setTaskDate] = useState(() => {
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    return `${d}-${m}-${y}`;
  });
  const [isSavingTask, setIsSavingTask] = useState(false);

  React.useEffect(() => {
    if (selectedSubjectId) {
      getCategoriesBySubject(selectedSubjectId)
        .then(setCategories)
        .catch(console.error);
    } else {
      setCategories([]);
    }
    setSelectedCategoryId(null);
  }, [selectedSubjectId]);

  const resetForm = () => {
    setTaskName('');
    const now = new Date();
    const d = now.getDate().toString().padStart(2, '0');
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const y = now.getFullYear();
    setTaskDate(`${d}-${m}-${y}`);
    setSelectedSubjectId(initialSubjectId || null);
    setSelectedCategoryId(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
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

  const handleSaveTask = async () => {
    if (!selectedSubjectId || !taskName.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.quickAddMenu.errors.fillFields'), type: 'warning' });
      return;
    }

    try {
      setIsSavingTask(true);
      const result = await createAssessment({
        subject_id: selectedSubjectId,
        name: taskName.trim(),
        date: taskDate,
        is_completed: false,
        type: 'task',
        category_id: selectedCategoryId || undefined,
      });

      if (isOnline) {
        await onTaskCreated();
      } else {
        useDataStore.setState(state => ({
          assessments: [result, ...state.assessments.filter(a => a.id !== (result as any).id)]
        }));
      }

      alertRef.show({
        title: t('common.success'),
        message: isOnline
          ? t('dashboard.quickAddMenu.task.success')
          : t('dashboard.quickAddMenu.task.offlineSuccess'),
        type: 'success',
      });

      handleClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.quickAddMenu.task.errorSave'), type: 'error' });
    } finally {
      setIsSavingTask(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <Pressable style={styles.sheetBackdrop} onPress={handleClose}>
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
                    ? Array.isArray(subjects) ? subjects.find(s => s.id === selectedSubjectId)?.name : undefined
                    : t('dashboard.quickAddMenu.grade.subjectPlaceholder')}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.text.placeholder} />
              </TouchableOpacity>

              {categories.length > 0 && (
                <>
                  <Text style={styles.sheetLabel}>{t('categories.category', 'Categoría')}</Text>
                  <TouchableOpacity 
                    style={styles.dropdownSelector} 
                    onPress={() => setIsCategorySelectorVisible(true)}
                  >
                    <Text style={[
                      styles.dropdownSelectorText, 
                      !selectedCategoryId && styles.dropdownPlaceholder
                    ]}>
                      {selectedCategoryId 
                        ? categories.find(c => c.id === selectedCategoryId)?.name 
                        : t('categories.none')}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.colors.text.placeholder} />
                  </TouchableOpacity>
                </>
              )}

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
              <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleClose}>
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

      <SubjectSelectorModal
        visible={isSubjectSelectorVisible}
        subjects={subjects}
        selectedSubjectId={selectedSubjectId}
        onSelectSubject={setSelectedSubjectId}
        onClose={() => setIsSubjectSelectorVisible(false)}
      />

      <CategorySelectorModal
        visible={isCategorySelectorVisible}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
        onClose={() => setIsCategorySelectorVisible(false)}
      />
    </>
  );
};
