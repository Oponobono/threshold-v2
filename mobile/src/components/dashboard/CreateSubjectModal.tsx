import { RepositoryFactory } from '../../services/database/RepositoryFactory';
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { alertRef } from '../ui/CustomAlert';
import { createSubject } from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import type { Course } from '../../services/api/types';

const SUBJECT_COLORS = [
  '#3B82F6', '#1D4ED8', '#22C55E', '#F59E0B', '#EC4899', '#7C3AED',
  '#0EA5E9', '#84CC16', '#F97316', '#14B8A6', '#6B7280', '#2563EB',
  '#10B981', '#FB923C', '#F43F5E', '#06B6D4', '#65A30D', '#D97706',
];
const SUBJECT_ICONS = [
  'book-outline', 'book-open-variant', 'notebook-outline',
  'calculator-variant-outline', 'atom-variant', 'flask-outline',
  'code-tags', 'chart-line', 'abacus', 'sigma', 'brain', 'earth',
  'palette-outline', 'music-note-outline', 'scale-balance', 'gavel',
  'dna', 'laptop', 'compass-outline', 'lightbulb-on-outline',
] as const;

interface CreateSubjectModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CreateSubjectModal = ({ visible, onClose }: CreateSubjectModalProps) => {
  const { t } = useTranslation();
  const { loadAllData } = useDataStore();
  
  const [isSavingSubject, setIsSavingSubject] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectProfessor, setSubjectProfessor] = useState('');
  const [subjectCredits, setSubjectCredits] = useState('');
  const [subjectTarget, setSubjectTarget] = useState('');
  const [selectedColor, setSelectedColor] = useState(SUBJECT_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState<(typeof SUBJECT_ICONS)[number]>('book-outline');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      RepositoryFactory.courses().getAll().then(setCourses).catch(console.error);
    }
  }, [visible]);

  const resetForm = () => {
    setSubjectName('');
    setSubjectProfessor('');
    setSubjectCredits('');
    setSubjectTarget('');
    setSelectedColor(SUBJECT_COLORS[0]);
    setSelectedIcon('book-outline');
    setSelectedCourseId(null);
    setIsSavingSubject(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!subjectName.trim()) {
      alertRef.show({ title: t('common.error'), message: t('dashboard.newSubject.errors.nameRequired'), type: 'warning' });
      return;
    }

    try {
      setIsSavingSubject(true);
      await createSubject({
        name: subjectName.trim(),
        professor: subjectProfessor.trim() || undefined,
        color: selectedColor,
        icon: selectedIcon,
        credits: subjectCredits ? Number(subjectCredits) : undefined,
        target_grade: subjectTarget ? Number(subjectTarget) : undefined,
        course_id: selectedCourseId,
      });

      await loadAllData(true);
      handleClose();
    } catch (error: any) {
      alertRef.show({ title: t('common.error'), message: error?.message || t('dashboard.newSubject.errors.createFailed'), type: 'error' });
    } finally {
      setIsSavingSubject(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.sheetBackdrop} onPress={handleClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('dashboard.newSubject.title')}</Text>
          <Text style={styles.sheetSubtitle}>{t('dashboard.newSubject.subtitle')}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }}>
            <Text style={styles.sheetLabel}>{t('dashboard.newSubject.name')}</Text>
            <TextInput
              value={subjectName}
              onChangeText={setSubjectName}
              style={styles.sheetInput}
              placeholder={t('dashboard.newSubject.namePlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            {courses.length > 0 && (
              <>
                <Text style={styles.sheetLabel}>Curso asociado (Opcional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 10 }}>
                  <TouchableOpacity
                    style={[
                      { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
                      selectedCourseId === null && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                    ]}
                    onPress={() => setSelectedCourseId(null)}
                  >
                    <Text style={{ color: selectedCourseId === null ? theme.colors.primary : theme.colors.text.secondary, fontWeight: selectedCourseId === null ? '600' : '400' }}>
                      Independiente
                    </Text>
                  </TouchableOpacity>
                  {courses.map(course => (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
                        selectedCourseId === course.id && { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                      ]}
                      onPress={() => setSelectedCourseId(course.id)}
                    >
                      <Text style={{ color: selectedCourseId === course.id ? theme.colors.primary : theme.colors.text.secondary, fontWeight: selectedCourseId === course.id ? '600' : '400' }}>
                        {course.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.sheetLabel}>{t('dashboard.newSubject.professor')}</Text>
            <TextInput
              value={subjectProfessor}
              onChangeText={setSubjectProfessor}
              style={styles.sheetInput}
              placeholder={t('dashboard.newSubject.professorPlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            <Text style={styles.sheetLabel}>{t('dashboard.newSubject.credits')}</Text>
            <TextInput
              value={subjectCredits}
              onChangeText={setSubjectCredits}
              style={styles.sheetInput}
              keyboardType="numeric"
              placeholder={t('dashboard.newSubject.creditsPlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            <Text style={styles.sheetLabel}>{t('dashboard.newSubject.targetGrade')}</Text>
            <TextInput
              value={subjectTarget}
              onChangeText={setSubjectTarget}
              style={styles.sheetInput}
              keyboardType="numeric"
              placeholder={t('dashboard.newSubject.targetGradePlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            <Text style={styles.sheetLabel}>{t('dashboard.newSubject.color')}</Text>
            <View style={styles.optionsRow}>
              {SUBJECT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorOptionSelected]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <Text style={styles.sheetLabel}>{t('dashboard.newSubject.icon')}</Text>
            <View style={styles.optionsRow}>
              {SUBJECT_ICONS.map((iconName) => (
                <TouchableOpacity
                  key={iconName}
                  style={[styles.iconOption, selectedIcon === iconName && styles.iconOptionSelected]}
                  onPress={() => setSelectedIcon(iconName)}
                >
                  <MaterialCommunityIcons name={iconName} size={18} color={theme.colors.text.primary} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={handleClose}>
              <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetSaveBtn, { flex: 1 }, isSavingSubject && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={isSavingSubject}
            >
              <Text style={styles.sheetSaveText}>
                {isSavingSubject ? t('dashboard.newSubject.saving') : t('dashboard.newSubject.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
