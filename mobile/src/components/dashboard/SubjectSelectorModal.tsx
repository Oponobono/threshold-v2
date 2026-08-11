import React from 'react';
import { View, Text, Modal, Pressable, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { type Subject } from '../../services/api';

interface SubjectSelectorModalProps {
  visible: boolean;
  subjects: Subject[];
  assignedSubjectIds?: string[];
  selectedSubjectId: string | null;
  onSelectSubject: (id: string) => void;
  onClose: () => void;
}

import { TextInput } from 'react-native';

export const SubjectSelectorModal = ({
  visible,
  subjects,
  assignedSubjectIds = [],
  selectedSubjectId,
  onSelectSubject,
  onClose
}: SubjectSelectorModalProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredSubjects = React.useMemo(() => {
    if (!searchQuery) return subjects;
    const lowerQuery = searchQuery.toLowerCase();
    return subjects.filter(s => s.name.toLowerCase().includes(lowerQuery));
  }, [subjects, searchQuery]);

  // Reset search when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={[styles.sheetContent, { maxHeight: '60%', paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={[styles.sheetTitle, { marginBottom: 12 }]}>{t('dashboard.quickAddMenu.grade.subjectPlaceholder')}</Text>
          
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.inputBackground,
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}>
            <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.text.placeholder} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, color: theme.colors.text.primary, fontSize: 15 }}
              placeholder={t('common.search', 'Buscar materia...')}
              placeholderTextColor={theme.colors.text.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredSubjects}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => {
              const hasSchedule = assignedSubjectIds.includes(item.id);
              const isSelected = selectedSubjectId === item.id;
              
              return (
                <TouchableOpacity 
                  style={[
                    { 
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 8, 
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: isSelected ? `${theme.colors.primary}15` : theme.colors.card,
                      borderWidth: 1,
                      borderColor: isSelected ? theme.colors.primary : 'transparent',
                    }
                  ]}
                  onPress={() => {
                    onSelectSubject(item.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ backgroundColor: item.color || '#CCCCCC', marginRight: 12, width: 10, height: 30, borderRadius: 4 }} />
                  <View style={{ flex: 1, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 2 }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: hasSchedule ? theme.colors.success : theme.colors.text.placeholder }}>
                      {hasSchedule ? 'Horario asignado' : 'Sin horario'}
                    </Text>
                  </View>
                  <MaterialCommunityIcons 
                    name={hasSchedule ? 'check-circle' : 'circle-outline'} 
                    size={20} 
                    color={hasSchedule ? theme.colors.success : theme.colors.border} 
                  />
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose}>
            <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};
