import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { gradesStyles } from '../../styles/Grades.styles';
import { normalizeGrade, parseWeight, SCALE_MAX } from '../../utils/grades';

// Refined elegant style - no heavy colors needed in the UI text itself
const GRADE_COLORS = (pct: number) => {
  if (pct >= 80) return theme.colors.success;
  if (pct >= 65) return theme.colors.warning;
  return theme.colors.danger;
};

interface AssessmentItemProps {
  assessment: any;
  index: number;
  globalIndex?: number;
  isLast: boolean;
  subject?: any;
  t: any;
}

export const AssessmentItem: React.FC<AssessmentItemProps> = ({
  assessment: a,
  index,
  globalIndex,
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
  
  // Format date discreetly (e.g. 15 Mar)
  const formattedDate = React.useMemo(() => {
    if (!a.date) return null;
    try {
      let d: Date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(a.date)) {
        const [y, m, day] = a.date.split('-').map(Number);
        d = new Date(y, m - 1, day);
      } else {
        d = new Date(a.date);
      }
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    } catch {
      return null;
    }
  }, [a.date]);

  return (
    <View style={[gradesStyles.assessItem, isLast && gradesStyles.assessItemLast, isPending && gradesStyles.assessItemPending]}>
      <View style={gradesStyles.assessInfo}>
        <View style={gradesStyles.assessNameRow}>
          {globalIndex !== undefined && (
            <Text style={gradesStyles.assessGlobalIndexText}>#{globalIndex + 1}</Text>
          )}
          {isPending && (
            <View style={gradesStyles.assessPendingBadge}>
              <Text style={gradesStyles.assessPendingText}>
                {t('common.syncing', 'SYNC')}
              </Text>
            </View>
          )}
        </View>
        <Text style={gradesStyles.assessName} numberOfLines={1}>{a.name}</Text>
        <Text style={gradesStyles.assessMeta} numberOfLines={1}>
          {subject?.name || 'Materia'}
          <Text style={{ opacity: 0.5 }}> • </Text>
          {weight > 0 ? `${weight}%` : (a.weight || t('grades.eval', 'Evaluación'))}
        </Text>
      </View>
      <View style={gradesStyles.assessScoreWrap}>
        {pct !== null ? (
          <Text style={gradesStyles.assessScore}>
            {gradeVal!.toFixed(1)}<Text style={gradesStyles.assessScoreScale}>/{SCALE_MAX}</Text>
          </Text>
        ) : (
          <Text style={[gradesStyles.assessStatus, { color: isTask && isCompleted ? theme.colors.text.primary : theme.colors.text.secondary }]}>
            {isTask
              ? (isCompleted ? t('common.done', 'Entregada') : t('subjects.pending', 'Pendiente'))
              : t('subjects.pending', 'Sin nota')}
          </Text>
        )}
        {formattedDate && (
          <Text style={gradesStyles.assessDateDiscreet}>{formattedDate}</Text>
        )}
      </View>
    </View>
  );
};
