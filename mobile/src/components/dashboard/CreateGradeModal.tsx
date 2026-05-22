import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { alertRef } from '../CustomAlert';
import { createAssessment, type Subject } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { SubjectSelectorModal } from './SubjectSelectorModal';
import { CategorySelectorModal } from './CategorySelectorModal';
import { getCategoriesBySubject, type AssessmentCategory } from '../../services/api/assessmentCategories';

interface CreateGradeModalProps {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectId?: number | null;
}

export const CreateGradeModal = ({ visible, onClose, subjects, initialSubjectId }: CreateGradeModalProps) => {
  const { t } = useTranslation();
  const { refreshSubjects, refreshAssessments } = useDataStore();

  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(initialSubjectId || null);
  const [isSubjectSelectorVisible, setIsSubjectSelectorVisible] = useState(false);
  const [categories, setCategories] = useState<AssessmentCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isCategorySelectorVisible, setIsCategorySelectorVisible] = useState(false);
  const [gradeName, setGradeName] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [gradePercentage, setGradePercentage] = useState('');
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
    setSelectedSubjectId(initialSubjectId || null);
    setSelectedCategoryId(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
        grade_value: gradeValue ? Number(gradeValue.replace(',', '.')) : 0,
        weight: gradePercentage ? gradePercentage.replace(',', '.') : '0',
        is_completed: true,
        type: 'grade',
        category_id: selectedCategoryId || undefined,
      });

      const subjectName = Array.isArray(subjects) ? subjects.find(s => s.id === selectedSubjectId)?.name || '' : '';
      alertRef.show({ title: t('common.success'), message: t('dashboard.quickAddMenu.grade.success', { subject: subjectName }), type: 'success' });
      
      await Promise.all([refreshSubjects(), refreshAssessments()]);
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
                        : t('categories.none', 'Sin categoría')}
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
