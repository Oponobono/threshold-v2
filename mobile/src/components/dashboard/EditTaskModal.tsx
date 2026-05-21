import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { alertRef } from '../CustomAlert';
import { updateAssessment, type Subject, Assessment } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { SubjectSelectorModal } from './SubjectSelectorModal';
import { CategorySelectorModal } from './CategorySelectorModal';
import { getCategoriesBySubject, type AssessmentCategory } from '../../services/api/assessmentCategories';

interface EditTaskModalProps {
  visible: boolean;
  onClose: () => void;
  task: Assessment | null;
  subjects: Subject[];
}

export const EditTaskModal = ({ visible, onClose, task, subjects }: EditTaskModalProps) => {
  const { t } = useTranslation();
  const { refreshSubjects } = useDataStore();

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [isSubjectSelectorVisible, setIsSubjectSelectorVisible] = useState(false);
  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isCategorySelectorVisible, setIsCategorySelectorVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when task changes
  useEffect(() => {
    if (task && visible) {
      setSelectedSubjectId(task.subject_id);
      setTaskName(task.name);
      setSelectedCategoryId(task.category_id || null);
    }
  }, [task, visible]);

  useEffect(() => {
    if (selectedSubjectId) {
      getCategoriesBySubject(selectedSubjectId)
        .then(setCategories)
        .catch(console.error);
    } else {
      setCategories([]);
    }
  }, [selectedSubjectId]);

  const handleClose = () => {
    onClose();
  };

  const handleSaveTask = async () => {
    if (!task?.id || !selectedSubjectId || !taskName.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.quickAddMenu.errors.fillFields'), type: 'warning' });
      return;
    }

    try {
      setIsSaving(true);
      await updateAssessment(task.id, {
        subject_id: selectedSubjectId,
        name: taskName.trim(),
        category_id: selectedCategoryId || undefined,
      });

      const subjectName = Array.isArray(subjects) ? subjects.find(s => s.id === selectedSubjectId)?.name || '' : '';
      alertRef.show({ title: t('common.success'), message: t('tasks.updateSuccess', 'Tarea actualizada'), type: 'success' });
      
      await refreshSubjects();
      handleClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('common.errorOccurred'), type: 'error' });
    } finally {
      setIsSaving(false);
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
            <Text style={styles.sheetTitle}>{t('tasks.editTask', 'Editar Tarea')}</Text>
            
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
                        : t('categories.none', 'Sin categoría')}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.colors.text.placeholder} />
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.newTask')}</Text>
              <TextInput
                value={taskName}
                onChangeText={setTaskName}
                style={styles.sheetInput}
                placeholder={t('dashboard.quickAddMenu.newTaskPlaceholder', 'Nombre de la tarea')}
                placeholderTextColor={theme.colors.text.placeholder}
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleClose}>
                <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSaveBtn, { flex: 1 }, isSaving && { opacity: 0.6 }]}
                onPress={handleSaveTask}
                disabled={isSaving}
              >
                <Text style={styles.sheetSaveText}>
                  {isSaving ? t('dashboard.newSubject.saving') : t('common.save', 'Guardar')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {selectedSubjectId && (
        <>
          <SubjectSelectorModal
            visible={isSubjectSelectorVisible}
            onClose={() => setIsSubjectSelectorVisible(false)}
            subjects={subjects}
            selectedSubjectId={selectedSubjectId}
            onSelectSubject={(subjectId) => {
              setSelectedSubjectId(subjectId);
              setIsSubjectSelectorVisible(false);
            }}
          />
          <CategorySelectorModal
            visible={isCategorySelectorVisible}
            onClose={() => setIsCategorySelectorVisible(false)}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={(categoryId) => {
              setSelectedCategoryId(categoryId);
              setIsCategorySelectorVisible(false);
            }}
          />
        </>
      )}
    </>
  );
};
