import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BoundedGrid } from '../ui/BoundedGrid';
import { SubjectCard } from './SubjectCard';
import { theme } from '../../styles/theme';

interface SubjectGridSectionProps {
  subjects: any[];
  courseName?: string;
  onSubjectPress: (subject: any) => void;
  onContinue: (subject: any) => void;
  onComplete: (subject: any) => void;
  onCreateSubject: () => void;
  subHeader?: React.ReactNode;
}

export const SubjectGridSection: React.FC<SubjectGridSectionProps> = ({
  subjects,
  courseName,
  onSubjectPress,
  onContinue,
  onComplete,
  onCreateSubject,
  subHeader,
}) => {
  const { t } = useTranslation();

  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const aAccess = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
      const bAccess = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
      if (aAccess !== bAccess) return bAccess - aAccess;
      
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bCreated - aCreated;
    });
  }, [subjects]);

  const emptyState = (
    <View style={styles.emptyContainer}>
      <Ionicons name="book-outline" size={32} color={theme.colors.primary} style={{ opacity: 0.5, marginBottom: 8 }} />
      <Text style={styles.emptyText}>{t('subjects.addFirstSubject', 'Agrega tu primera materia')}</Text>
      <TouchableOpacity style={styles.addBtn} onPress={onCreateSubject}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.addBtnText}>{t('subjects.newSubject', 'Nueva materia')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BoundedGrid
      data={sortedSubjects}
      keyExtractor={(item) => item.id}
      title={t('subjects.yourSubjects', 'Tus materias')}
      contextText={subjects.length > 0 ? `(${subjects.length})` : undefined}
      numColumns={2}
      maxHeight={500}
      gap={8}
      subHeader={subHeader}
      ListEmptyComponent={emptyState}
      renderItem={({ item }) => (
        <View style={{ flex: 1 }}>
          <SubjectCard
            subject={item}
            onPress={() => onSubjectPress(item)}
            onContinue={item.external_url ? () => onContinue(item) : undefined}
            onComplete={() => onComplete(item)}
          />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    width: '100%',
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    marginBottom: 16,
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
