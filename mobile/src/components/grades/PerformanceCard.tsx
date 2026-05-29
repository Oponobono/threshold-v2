import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { gradesStyles } from '../../styles/Grades.styles';
import { normalizeGrade, SCALE_MAX } from '../../utils/grades';

interface PerformanceCardProps {
  displayGPA: string;
  displayProjectedGPA: string;
  displayDelta: number | null;
  selectedSubjectId: number | null;
  globalGPA: any;
  gradedAssessments: any[];
  onPressInfo?: () => void;
  t: any;
  selectedSubject?: any;
  globalGpaLetter?: { label: string; color: string } | null;
  globalProjectedLetter?: { label: string; color: string } | null;
  activeSystem?: { name: string } | null;
}

export const PerformanceCard: React.FC<PerformanceCardProps> = ({
  displayGPA,
  displayProjectedGPA,
  displayDelta,
  selectedSubjectId,
  globalGPA,
  gradedAssessments,
  onPressInfo,
  t,
  selectedSubject,
  globalGpaLetter,
  globalProjectedLetter,
  activeSystem,
}) => {
  const letterBadge = selectedSubject?.display_label
    ? { label: selectedSubject.display_label, color: selectedSubject.display_color || '#5856D6' }
    : (!selectedSubjectId && globalGpaLetter)
      ? { label: globalGpaLetter.label, color: globalGpaLetter.color }
      : null;

  const projectedBadge = selectedSubjectId && selectedSubject?.display_label
    ? null
    : (!selectedSubjectId && globalProjectedLetter)
      ? { label: globalProjectedLetter.label, color: globalProjectedLetter.color }
      : null;

  const scaleName = activeSystem ? t(activeSystem.name) : t('grades.editScale');
  return (
    <View style={gradesStyles.card}>
      <View style={[globalStyles.rowBetweenCenter, { marginBottom: 12 }]}>
        <Text style={gradesStyles.sectionTitle}>
          {t('grades.academicPerformance', 'Rendimiento general')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {onPressInfo && (
            <TouchableOpacity onPress={onPressInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="information-circle-outline" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[gradesStyles.scaleBadgeRow]}>
        <TouchableOpacity style={gradesStyles.scaleBadge}>
          <Ionicons name="settings-outline" size={12} color={theme.colors.text.secondary} style={{ marginRight: 4 }} />
          <Text style={gradesStyles.scaleBadgeText} numberOfLines={1}>
            {scaleName}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[globalStyles.rowCenter, { marginBottom: 16, marginTop: 12 }]}>
        <View style={[globalStyles.flex1, globalStyles.centerHorizontal]}>
          <Text style={gradesStyles.gpaMetricLabel}>{t('grades.termGpa')}</Text>
          <Text style={gradesStyles.gpaMetricValue}>{displayGPA}</Text>
          {letterBadge && (
            <View style={{ marginTop: 4 }}>
              <Text style={[gradesStyles.projectedMetaText, { color: letterBadge.color, textTransform: 'none', fontSize: 12 }]}>
                {letterBadge.label}
              </Text>
            </View>
          )}
        </View>
        <View style={gradesStyles.gpaDivider} />
        <View style={[globalStyles.flex1, globalStyles.centerHorizontal]}>
          <Text style={gradesStyles.gpaMetricLabel}>{t('grades.projected')}</Text>
          <Text
            style={[
              gradesStyles.gpaMetricValue,
              {
                color: displayDelta && displayDelta > 0 ? '#34C759' : (displayDelta && displayDelta < 0 ? '#FF2D55' : theme.colors.text.secondary),
                opacity: selectedSubjectId === null && !globalGPA ? 0.6 : 1,
              },
            ]}
          >
            {displayProjectedGPA}
          </Text>
          {projectedBadge && (
            <View style={{ marginTop: 4 }}>
              <Text style={[gradesStyles.projectedMetaText, { color: projectedBadge.color, textTransform: 'none', fontSize: 12 }]}>
                {projectedBadge.label}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={gradesStyles.projectedMetaRow}>
        <Text style={gradesStyles.projectedMetaText}>
          {t('grades.projected')}:{' '}
          <Text style={{ color: theme.colors.text.primary }}>
            {parseFloat(displayProjectedGPA) > 0
              ? `${displayProjectedGPA}${displayDelta ? ` (${displayDelta > 0 ? '+' : ''}${displayDelta.toFixed(2)} pts)` : ''}`
              : t('grades.insufficientData', 'Faltan evaluaciones')}
          </Text>
        </Text>
      </View>

      <View style={gradesStyles.sparklineRow}>
        {gradedAssessments.length === 0 ? (
          Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={gradesStyles.sparklineBarPlaceholder} />
          ))
        ) : (
          gradedAssessments.slice(-12).map((a: any, i: number, arr: any[]) => {
            const val = normalizeGrade(a) ?? 0;
            const h = Math.max(15, Math.min(100, (val / SCALE_MAX) * 100));
            const isLast = i === arr.length - 1;
            return (
              <View
                key={i}
                style={[
                  gradesStyles.sparklineBar,
                  {
                    height: `${h}%`,
                    backgroundColor: isLast ? theme.colors.primary : theme.colors.primary + '40',
                  },
                ]}
              />
            );
          })
        )}
      </View>
    </View>
  );
};
