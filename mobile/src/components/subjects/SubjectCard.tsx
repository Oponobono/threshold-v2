import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SCALE_MAX } from '../../utils/grades';
import { formatSubjectTitle } from '../../utils/textFormat';
import { styles } from '../../styles/SubjectCard.styles';

interface SubjectCardProps {
  subject: any;
  onPress: (subject: any) => void;
  onContinue?: (subject: any) => void;
  onComplete?: (subject: any) => void;
}

export const SubjectCard = React.memo((
  { subject, onPress, onContinue, onComplete }: SubjectCardProps,
) => {

  const color = subject.color || '#6B7280';


  const raw = subject.avg_score ?? 0;
  const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
  const hasGrade = avg > 0;

  const progress = subject.total_lessons && subject.total_lessons > 0
    ? (subject.completed_lessons || 0) / subject.total_lessons
    : (subject.completion_percent || 0) / 100;
  const progressPct = Math.min(Math.round(progress * 100), 100);
  const isComplete = progressPct >= 100;

  let statusColor = '#D97706'; // Ámbar para "En curso"
  let statusBgColor = '#FEF3C7';
  let statusBorderColor = '#FDE68A';
  let statusIconName: 'time-outline' | 'checkmark-circle' | 'ellipse-outline' = 'time-outline';
  let statusText = 'En curso';

  if (isComplete) {
    statusColor = '#059669'; // Verde para "Completa"
    statusBgColor = '#D1FAE5';
    statusBorderColor = '#A7F3D0';
    statusIconName = 'checkmark-circle';
    statusText = 'Completa';
  } else if (progressPct === 0) {
    statusColor = '#6B7280'; // Gris para "Sin iniciar"
    statusBgColor = '#F3F4F6';
    statusBorderColor = '#E5E7EB';
    statusIconName = 'ellipse-outline';
    statusText = 'Sin iniciar';
  }

  const milestoneStr = subject.next_micro_milestone || subject.next_milestone;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}
      onPress={() => onPress(subject)}
      accessibilityLabel={`${subject.name || 'Materia'}, estado ${statusText}, promedio ${hasGrade ? avg.toFixed(1) : 'sin calificar'}, ${progressPct}% de progreso`}
    >

      <View style={styles.headerTitleBlock}>
        <Text style={styles.title} numberOfLines={2}>
          {formatSubjectTitle(subject.name || 'Materia')}
        </Text>
        <Text style={styles.professorText} numberOfLines={1}>
          {subject.professor ? `Prof. ${subject.professor}` : 'Sin profesor'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.bodyContent}>
        <View style={styles.avgBadge}>
          <Text style={styles.avgBadgeText} numberOfLines={1} ellipsizeMode="tail">
            Prom. <Text style={{ color: '#111827', fontWeight: '700' }}>{hasGrade ? avg.toFixed(1) : '—'}</Text>
          </Text>
        </View>

        <View style={[styles.statusChip, { backgroundColor: statusBgColor, borderColor: statusBorderColor }]}>
          <Ionicons name={statusIconName} size={12} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
            {statusText}{milestoneStr && !isComplete ? ` · ${milestoneStr}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Progreso</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.progressPercent}>{progressPct}%</Text>
            {onComplete && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onComplete(subject);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Procesar clase"
              >
                <Ionicons name="sparkles" size={14} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: color }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
});
