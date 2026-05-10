import React from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';

const SUBJECT_COLORS = [
  '#E7EDF8', '#DDE7FF', '#EAF4EE', '#FCEFD9', '#F7E9EE', '#ECE8FF',
  '#E3F2FD', '#F2F5D9', '#F3ECE6', '#DDF3F0', '#EDEDED', '#D7E3FC',
  '#CDEAC0', '#FFD6BA', '#FFC8DD', '#CDE7F0', '#E8F0D8', '#E6E2D3',
];
const SUBJECT_ICONS = [
  'book-outline', 'book-open-variant', 'notebook-outline', 'calculator-variant-outline',
  'atom-variant', 'flask-outline', 'code-tags', 'chart-line', 'abacus', 'sigma',
  'brain', 'earth', 'palette-outline', 'music-note-outline', 'scale-balance',
  'gavel', 'dna', 'laptop', 'compass-outline', 'lightbulb-on-outline',
] as const;



interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  subjectName: string;
  setSubjectName: (v: string) => void;
  subjectProfessor: string;
  setSubjectProfessor: (v: string) => void;
  subjectTarget: string;
  setSubjectTarget: (v: string) => void;
  selectedColor: string;
  setSelectedColor: (v: string) => void;
  selectedIcon: string;
  setSelectedIcon: (v: string) => void;
  isSaving: boolean;
}

export const AddSubjectModal = React.memo(({
  visible, onClose, onSave,
  subjectName, setSubjectName,
  subjectProfessor, setSubjectProfessor,
  subjectTarget, setSubjectTarget,
  selectedColor, setSelectedColor,
  selectedIcon, setSelectedIcon,
  isSaving,
}: Props) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
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

            <Text style={styles.sheetLabel}>{t('dashboard.newSubject.professor')}</Text>
            <TextInput
              value={subjectProfessor}
              onChangeText={setSubjectProfessor}
              style={styles.sheetInput}
              placeholder={t('dashboard.newSubject.professorPlaceholder')}
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
            <TouchableOpacity style={[styles.sheetCancelBtn, { flex: 1 }]} onPress={onClose}>
              <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetSaveBtn, { flex: 1 }, isSaving && { opacity: 0.6 }]}
              onPress={onSave}
              disabled={isSaving}
            >
              <Text style={styles.sheetSaveText}>
                {isSaving ? t('dashboard.newSubject.saving') : t('dashboard.newSubject.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
AddSubjectModal.displayName = 'AddSubjectModal';
