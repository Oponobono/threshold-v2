import React from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { Subject } from '../../../src/services/api/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  subjects: Subject[];
  selectedSubjectId: string | null;
  onOpenSubjectSelector: () => void;
  gradeName: string;
  setGradeName: (v: string) => void;
  gradeValue: string;
  setGradeValue: (v: string) => void;
  gradePercentage: string;
  setGradePercentage: (v: string) => void;
  isSaving: boolean;
}

export const AddGradeModal = React.memo(({
  visible, onClose, onSave,
  subjects, selectedSubjectId, onOpenSubjectSelector,
  gradeName, setGradeName,
  gradeValue, setGradeValue,
  gradePercentage, setGradePercentage,
  isSaving,
}: Props) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContent} onPress={() => null}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('dashboard.quickAddMenu.grade.title')}</Text>

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

            <Text style={styles.sheetLabel}>{t('dashboard.quickAddMenu.grade.name')}</Text>
            <TextInput
              value={gradeName}
              onChangeText={setGradeName}
              style={styles.sheetInput}
              placeholder={t('dashboard.quickAddMenu.grade.namePlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
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
              <View style={{ flex: 1 }}>
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
            <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={onClose}>
              <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetSaveBtn, { flex: 1 }, isSaving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={isSaving}
            >
              <Text style={styles.sheetSaveText}>
                {isSaving ? t('dashboard.newSubject.saving') : t('dashboard.quickAddMenu.grade.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
AddGradeModal.displayName = 'AddGradeModal';
