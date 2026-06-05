import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { alertRef } from '../ui/CustomAlert';
import { updateAssessment, type Subject, Assessment } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { SubjectSelectorModal } from './SubjectSelectorModal';
import { CategorySelectorModal } from './CategorySelectorModal';
import { getCategoriesBySubject, type AssessmentCategory } from '../../services/api/assessmentCategories';
import { AssessmentFileManager } from '../grades/AssessmentFileManager';

interface EditGradeModalProps {
  visible: boolean;
  onClose: () => void;
  assessment: Assessment | null;
  subjects: Subject[];
  onAssessmentSaved?: (assessment: Assessment) => void;
}

export const EditGradeModal = ({ visible, onClose, assessment, subjects, onAssessmentSaved }: EditGradeModalProps) => {
  const { t } = useTranslation();
  const { refreshSubjects, refreshAssessments } = useDataStore();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isSubjectSelectorVisible, setIsSubjectSelectorVisible] = useState(false);
  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategorySelectorVisible, setIsCategorySelectorVisible] = useState(false);
  const [gradeName, setGradeName] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [gradePercentage, setGradePercentage] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [gradingDate, setGradingDate] = useState<Date | null>(null);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showGradingDatePicker, setShowGradingDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when assessment changes
  useEffect(() => {
    if (assessment && visible) {
      setSelectedSubjectId(assessment.subject_id ? String(assessment.subject_id) : null);
      setGradeName(assessment.name);
      setGradeValue(assessment.grade_value?.toString() || assessment.score?.toString() || '');
      setGradePercentage(assessment.weight?.toString() || assessment.percentage?.toString() || '');
      setSelectedCategoryId(assessment.category_id ? String(assessment.category_id) : null);
      
      // Parse dates from assessment
      if (assessment.due_date) {
        const parsedDueDate = new Date(assessment.due_date);
        setDueDate(isNaN(parsedDueDate.getTime()) ? null : parsedDueDate);
      } else {
        setDueDate(null);
      }
      
      if (assessment.grading_date) {
        const parsedGradingDate = new Date(assessment.grading_date);
        setGradingDate(isNaN(parsedGradingDate.getTime()) ? null : parsedGradingDate);
      } else {
        setGradingDate(null);
      }
    }
  }, [assessment, visible]);

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

  const handleDueDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDueDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleGradingDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowGradingDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setGradingDate(selectedDate);
    }
  };

  const formatDateForDisplay = (date: Date | null) => {
    if (!date) return t('assessments.selectDate');
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatDateForAPI = (date: Date | null) => {
    if (!date) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  const handleSaveGrade = async () => {
    if (!assessment?.id || !selectedSubjectId || !gradeName.trim() || !gradeValue.trim() || !gradePercentage.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.quickAddMenu.errors.fillFields'), type: 'warning' });
      return;
    }

    try {
      setIsSaving(true);
      const updatePayload = {
        subject_id: selectedSubjectId as string,
        name: gradeName.trim(),
        grade_value: gradeValue ? Number(gradeValue.replace(',', '.')) : 0,
        weight: gradePercentage ? gradePercentage.replace(',', '.') : '0',
        category_id: selectedCategoryId || undefined,
        is_completed: 1 as unknown as number,
        due_date: formatDateForAPI(dueDate) || undefined,
        grading_date: formatDateForAPI(gradingDate) || undefined,
      };
      console.log('[EditGradeModal] 📤 Enviando UPDATE assessment:', {
        assessmentId: assessment.id,
        payload: updatePayload,
        gradeValueType: typeof updatePayload.grade_value,
        weightType: typeof updatePayload.weight,
      });
      
      const updatedAssessment = await updateAssessment(assessment.id, updatePayload);
      
      console.log('[EditGradeModal] 📥 Respuesta del backend:', {
        id: updatedAssessment?.id,
        grade_value: updatedAssessment?.grade_value,
        score: updatedAssessment?.score,
        normalized_value: updatedAssessment?.normalized_value,
        is_completed: updatedAssessment?.is_completed,
        weight: updatedAssessment?.weight,
        gradeValueType: typeof updatedAssessment?.grade_value,
        normalized_valueType: typeof updatedAssessment?.normalized_value,
      });

      const subjectName = Array.isArray(subjects) ? subjects.find(s => s.id === selectedSubjectId)?.name || '' : '';
      alertRef.show({ title: t('common.success'), message: t('assessments.updateSuccess'), type: 'success' });
      
      // Call callback with updated assessment ONLY if the backend returned a valid full object
      if (onAssessmentSaved && updatedAssessment?.id) {
        console.log('[EditGradeModal] 🔄 Llamando onAssessmentSaved con assessment completo del backend');
        onAssessmentSaved(updatedAssessment as Assessment);
      } else if (updatedAssessment && !updatedAssessment.id) {
        console.warn('[EditGradeModal] ⚠️ Backend no retornó un objeto completo, skipping onAssessmentSaved');
      }
      
      console.log('[EditGradeModal] 🔄 Refrescando store...', { refreshSubjects: !!refreshSubjects, refreshAssessments: !!refreshAssessments });
      await Promise.all([refreshSubjects(), refreshAssessments()]);
      console.log('[EditGradeModal] ✅ Store refrescado exitosamente');
      handleClose();
    } catch (error: any) {
      console.error('[EditGradeModal] ❌ Error al guardar:', { message: error?.message, error });
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.quickAddMenu.grade.errorSave'), type: 'error' });
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
            <Text style={styles.sheetTitle}>{t('assessments.editGrade')}</Text>
            
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
                  <Text style={styles.sheetLabel}>{t('categories.category')}</Text>
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

              <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.name')}</Text>
              <TextInput
                value={gradeName}
                onChangeText={setGradeName}
                style={styles.sheetInput}
                placeholder={t('dashboard.quickAddMenu.grade.namePlaceholder')}
                placeholderTextColor={theme.colors.text.placeholder}
              />

              <Text style={styles.sheetLabel}>{t('assessments.dueDate')}</Text>
              <TouchableOpacity 
                style={styles.sheetInput} 
                onPress={() => setShowDueDatePicker(true)}
              >
                <Text style={[styles.sheetInput, { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 }, !dueDate && { color: theme.colors.text.placeholder }]}>
                  {formatDateForDisplay(dueDate)}
                </Text>
              </TouchableOpacity>

              {showDueDatePicker && (
                <DateTimePicker
                  value={dueDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDueDateChange}
                />
              )}

              <Text style={styles.sheetLabel}>{t('assessments.gradingDate')}</Text>
              <TouchableOpacity 
                style={styles.sheetInput} 
                onPress={() => setShowGradingDatePicker(true)}
              >
                <Text style={[styles.sheetInput, { borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 }, !gradingDate && { color: theme.colors.text.placeholder }]}>
                  {formatDateForDisplay(gradingDate)}
                </Text>
              </TouchableOpacity>

              {showGradingDatePicker && (
                <DateTimePicker
                  value={gradingDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleGradingDateChange}
                />
              )}

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

              {assessment?.id && (
                <AssessmentFileManager assessmentId={assessment.id} />
              )}
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleClose}>
                <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetSaveBtn, { flex: 1 }, isSaving && { opacity: 0.6 }]}
                onPress={handleSaveGrade}
                disabled={isSaving}
              >
                <Text style={styles.sheetSaveText}>
                  {isSaving ? t('dashboard.newSubject.saving') : t('common.save')}
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
