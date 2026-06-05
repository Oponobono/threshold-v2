import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { alertRef } from '../ui/CustomAlert';
import { createAssessment, type Subject } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';

import { SubjectSelectorModal } from './SubjectSelectorModal';
import { CategorySelectorModal } from './CategorySelectorModal';
import { getCategoriesBySubject, type AssessmentCategory } from '../../services/api/assessmentCategories';

interface CreateGradeModalProps {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectId?: string | null;
}

export const CreateGradeModal = ({ visible, onClose, subjects, initialSubjectId }: CreateGradeModalProps) => {
  const { t } = useTranslation();
  const { refreshSubjects, refreshAssessments } = useDataStore();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(initialSubjectId ? String(initialSubjectId) : null);
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
  const [isSavingGrade, setIsSavingGrade] = useState(false);

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
    setGradeName('');
    setGradeValue('');
    setGradePercentage('');
    setDueDate(null);
    setGradingDate(null);
    setShowDueDatePicker(false);
    setShowGradingDatePicker(false);
    setSelectedSubjectId(initialSubjectId ? String(initialSubjectId) : null);
    setSelectedCategoryId(null);
    setIsSavingGrade(false);
  };

  const handleClose = () => {
    resetForm();
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
    if (!selectedSubjectId || !gradeName.trim() || !gradeValue.trim() || !gradePercentage.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.quickAddMenu.errors.fillFields'), type: 'warning' });
      return;
    }

    try {
      setIsSavingGrade(true);
      const result = await createAssessment({
        subject_id: selectedSubjectId,
        name: gradeName.trim(),
        grade_value: gradeValue ? Number(gradeValue.replace(',', '.')) : 0,
        weight: gradePercentage ? Number(gradePercentage.replace(',', '.')) : 0,
        is_completed: 1,
        type: 'grade',
        category_id: selectedCategoryId || undefined,
        due_date: formatDateForAPI(dueDate) || undefined,
        grading_date: formatDateForAPI(gradingDate) || undefined,
      });

      const subjectName = Array.isArray(subjects) ? subjects.find(s => s.id === selectedSubjectId)?.name || '' : '';

      if (result._isPending) {
        useDataStore.setState(state => ({
          assessments: [result, ...state.assessments.filter(a => a.id !== result.id)]
        }));
        alertRef.show({
          title: t('common.success'),
          message: t('dashboard.quickAddMenu.grade.offlineSuccess', { subject: subjectName }),
          type: 'success',
        });
      } else {
        await Promise.all([refreshSubjects(), refreshAssessments()]);
        alertRef.show({
          title: t('common.success'),
          message: t('dashboard.quickAddMenu.grade.success', { subject: subjectName }),
          type: 'success',
        });
      }

      handleClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.quickAddMenu.grade.errorSave'), type: 'error' });
    } finally {
      setIsSavingGrade(false);
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
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleClose}>
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
