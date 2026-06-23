import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { SubjectIcon } from './SubjectIcon';
import { Subject } from '../../services/api/types';

interface CourseSubjectCardProps {
  subject: Subject & {
    avg_score?: number;
    completion_percent?: number;
    delta?: number;
    next_milestone?: string;
    course_id?: string | null;
    courseName?: string;
  };
  onPress: () => void;
  onContinue?: () => void;
  onClassComplete?: () => void; // Disparador bicéfalo Fase 5
  platform?: string;
}

export const CourseSubjectCard = React.memo(({ subject, onPress, onContinue, onClassComplete, platform }: CourseSubjectCardProps) => {
  const cardColor = subject.color || '#5856D6';
  const progressText = subject.total_lessons && subject.total_lessons > 0
    ? `${subject.completed_lessons || 0}/${subject.total_lessons} clases`
    : `${Math.round(subject.completion_percent || 0)}%`;

  return (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={onPress}
      style={styles.container}
    >
      <View style={styles.topRow}>
        <View style={styles.titleSection}>
          <View style={[styles.iconContainer, { backgroundColor: cardColor }]}>
            <SubjectIcon iconName={subject.icon} color="#FFF" size={16} />
          </View>
          <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
        </View>

        {onContinue && (
          <TouchableOpacity 
            style={[styles.continuePill, { borderColor: cardColor }]}
            onPress={onContinue}
          >
            <Ionicons name="play" size={12} color={cardColor} />
            <Text style={[styles.continueText, { color: cardColor }]}>Continuar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.pillsContainer}>
        {platform && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{platform}</Text>
          </View>
        )}

        <View style={styles.pill}>
          <Text style={styles.pillEmoji}>📚</Text>
          <Text style={styles.pillText}>{progressText}</Text>
        </View>

        {subject.external_url && (
          <View style={styles.pill}>
            <Ionicons name="link" size={12} color={theme.colors.text.secondary} style={styles.pillIcon} />
            <Text style={styles.pillText}>Clase Abierta</Text>
          </View>
        )}
      </View>

      {(subject.next_milestone || subject.next_micro_milestone) && (
        <View style={styles.milestoneRow}>
          <Text style={styles.milestoneEmoji}>🎯</Text>
          <Text style={styles.milestoneText} numberOfLines={1}>
            Próximo hito: {subject.next_micro_milestone || subject.next_milestone}
          </Text>
        </View>
      )}

      {/* Disparador Bicéfalo: Boost Momentum + Abrir ZyrenIngestionModal */}
      {onClassComplete && (
        <TouchableOpacity style={styles.classDoneBtn} onPress={onClassComplete}>
          <Ionicons name="checkmark-circle-outline" size={14} color="#34C759" />
          <Text style={styles.classDoneText}>Marcar clase terminada</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subjectName: {
    color: theme.colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  continuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  continueText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  pillIcon: {
    marginRight: 4,
  },
  pillText: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  milestoneEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  milestoneText: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    flex: 1,
  },
  classDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-start',
    gap: 6,
  },
  classDoneText: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '600',
  },
});
