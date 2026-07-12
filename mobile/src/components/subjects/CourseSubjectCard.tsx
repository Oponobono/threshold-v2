import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubjectIcon } from './SubjectIcon';
import { Subject } from '../../services/api/types';
import { styles } from '../../styles/CourseSubjectCard.styles';
import { theme } from '../../styles/theme';

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
