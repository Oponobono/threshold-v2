import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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

  const startGridRender = performance.now();

  React.useEffect(() => {
    console.log(`[PerfProfile] Grid Render -> Commit: ${(performance.now() - startGridRender).toFixed(1)} ms`);
  }, []);

  const sortedSubjects = useMemo(() => {
    return [...subjects].sort((a, b) => {
      // 1. Sort by status: "En curso" first (progress > 0 && < 100). 
      // "Completa" (>= 100) and "Sin iniciar" (0) go after.
      const getProgress = (s: any) => {
        const p = s.total_lessons && s.total_lessons > 0
          ? (s.completed_lessons || 0) / s.total_lessons
          : (s.completion_percent || 0) / 100;
        return Math.min(Math.round(p * 100), 100);
      };
      
      const pA = getProgress(a);
      const pB = getProgress(b);
      const aInProgress = pA > 0 && pA < 100 ? 1 : 0;
      const bInProgress = pB > 0 && pB < 100 ? 1 : 0;
      
      if (aInProgress !== bInProgress) {
        return bInProgress - aInProgress; // "En curso" first
      }

      // 2. Sort by last accessed
      const aAccess = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
      const bAccess = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
      if (aAccess !== bAccess) return bAccess - aAccess;
      
      // 3. Sort by created date
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('subjects.yourSubjects', 'Tus materias')}</Text>
          {subjects.length > 0 && <Text style={styles.contextText}>({subjects.length})</Text>}
        </View>
        {subHeader && <View>{subHeader}</View>}
      </View>

      {sortedSubjects.length === 0 ? (
        emptyState
      ) : (
        <ScrollView 
          style={styles.scrollGrid} 
          contentContainerStyle={styles.scrollGridContent}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {Array.from({ length: Math.ceil(sortedSubjects.length / 2) }).map((_, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {Array.from({ length: 2 }).map((_, colIndex) => {
                  const itemIndex = rowIndex * 2 + colIndex;
                  const item = sortedSubjects[itemIndex];
                  if (!item) {
                    return <View key={`empty-${colIndex}`} style={{ flex: 1 }} />;
                  }
                  return (
                    <View key={item.id} style={{ flex: 1 }}>
                      <SubjectCard
                        subject={item}
                        onPress={onSubjectPress}
                        onContinue={item.external_url ? onContinue : undefined}
                        onComplete={onComplete}
                      />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 16,
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  scrollGrid: {
    maxHeight: 520,
    marginHorizontal: -4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)', // Más opaco/visible
  },
  scrollGridContent: {
    paddingHorizontal: 4,
    paddingTop: 16,
    paddingBottom: 24,
  },
  grid: {
    flexDirection: 'column',
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
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
