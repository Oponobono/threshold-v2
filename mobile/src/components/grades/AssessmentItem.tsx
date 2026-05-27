import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { gradesStyles } from '../../styles/Grades.styles';
import { normalizeGrade, parseWeight, SCALE_MAX } from '../../utils/grades';

const GRADE_COLORS = (pct: number) => {
  if (pct >= 80) return '#34C759';
  if (pct >= 65) return '#FF9500';
  return '#FF2D55';
};

interface AssessmentItemProps {
  assessment: any;
  index: number;
  isLast: boolean;
  subject?: any;
  t: any;
}

export const AssessmentItem: React.FC<AssessmentItemProps> = ({
  assessment: a,
  index,
  isLast,
  subject,
  t,
}) => {
  const gradeVal = normalizeGrade(a);
  const weight = parseWeight(a);
  const pct = gradeVal !== null ? Math.round((gradeVal / SCALE_MAX) * 100) : null;
  const color = subject?.color || '#5856D6';
  const isTask = a.type === 'task';
  const isCompleted = a.is_completed;
  const isPending = a._isPending === true;

  return (
    <View style={[gradesStyles.assessItem, isLast && gradesStyles.assessItemLast, isPending && gradesStyles.assessItemPending]}>
      <View style={[gradesStyles.assessIconBox, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons
          name={isTask ? 'check-circle' : 'file-document'}
          size={24}
          color={pct !== null ? GRADE_COLORS(pct) : theme.colors.text.secondary}
        />
      </View>
      <View style={gradesStyles.assessInfo}>
        <View style={gradesStyles.assessNameRow}>
          <Text style={gradesStyles.assessName} numberOfLines={1}>{a.name}</Text>
          {isPending && (
            <View style={gradesStyles.assessPendingBadge}>
              <Text style={gradesStyles.assessPendingText}>
                {t('common.syncing', 'SINCRONIZANDO')}
              </Text>
            </View>
          )}
        </View>
        <Text style={gradesStyles.assessMeta} numberOfLines={1}>
          {subject?.name || 'Materia'}
          <Text style={{ opacity: 0.5 }}> • </Text>
          {weight > 0 ? `${weight}%` : (a.weight || t('grades.eval', 'Evaluación'))}
        </Text>
      </View>
      <View style={gradesStyles.assessScoreWrap}>
        {pct !== null ? (
          <>
            <Text style={[gradesStyles.assessScore, { color: GRADE_COLORS(pct) }]}>
              {gradeVal!.toFixed(1)}/{SCALE_MAX}
            </Text>
          </>
        ) : (
          <Text style={[gradesStyles.assessStatus, { color: isTask && isCompleted ? '#34C759' : theme.colors.text.secondary }]}>
            {isTask
              ? (isCompleted ? t('common.done', 'Entregada') : t('subjects.pending', 'Pendiente'))
              : t('subjects.pending', 'Sin nota')}
          </Text>
        )}
      </View>
    </View>
  );
};
