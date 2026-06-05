import React from 'react';
import { View, Text, Modal, Pressable, FlatList, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { type Subject } from '../../services/api';

interface SubjectSelectorModalProps {
  visible: boolean;
  subjects: Subject[];
  selectedSubjectId: string | null;
  onSelectSubject: (id: string) => void;
  onClose: () => void;
}

export const SubjectSelectorModal = ({
  visible,
  subjects,
  selectedSubjectId,
  onSelectSubject,
  onClose
}: SubjectSelectorModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={[styles.sheetContent, { maxHeight: '60%' }]}>
          <Text style={[styles.sheetTitle, { marginBottom: 16 }]}>{t('dashboard.quickAddMenu.grade.subjectPlaceholder')}</Text>
          <FlatList
            data={subjects}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.quickAddMenuItem, 
                  { marginBottom: 12, padding: 16 },
                  selectedSubjectId === item.id && { borderColor: theme.colors.primary, borderWidth: 2 }
                ]}
                onPress={() => {
                  onSelectSubject(item.id);
                  onClose();
                }}
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
};
