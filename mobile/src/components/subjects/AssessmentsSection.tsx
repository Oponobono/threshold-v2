import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { subjectsStyles } from '../../styles/Subjects.styles';
import { normalizeGrade, SCALE_MAX } from '../../utils/grades';

interface AssessmentsSectionProps {
  subject: any;
  assessments: any[];
  t: any;
}

const ICON_MAP: Record<string, string> = {
  'task': 'clipboard-check-outline',
  'exam': 'file-document-outline',
  'quiz': 'help-circle-outline',
  'grade': 'medal-outline',
};

const BAR_COLORS = ['#5856D6', '#FF9500', '#34C759', '#FF2D55'];

export const AssessmentsSection: React.FC<AssessmentsSectionProps> = ({ subject, assessments, t }) => {
  return (
    <View style={subjectsStyles.assessCard}>
      <View style={[subjectsStyles.assessHeader, { marginBottom: 16 }]}>
        <View style={subjectsStyles.assessHeaderLeft}>
          <View style={subjectsStyles.assessHeaderIcon}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={[subjectsStyles.assessTitle, { marginBottom: 2 }]}>
              {t('subjects.academicTracking', 'Seguimiento académico')}
            </Text>
            <View style={subjectsStyles.assessStatusRow}>
              {assessments.length > 0 ? (
                <>
                  <View style={[subjectsStyles.assessStatusDot, { backgroundColor: theme.colors.success }]} />
                  <Text style={subjectsStyles.assessStatusText}>
                    {assessments.length} {t('subjects.registered', 'notas registradas')}
                  </Text>
                </>
              ) : (
                <>
                  <View style={[subjectsStyles.assessStatusDot, { backgroundColor: theme.colors.text.secondary }]} />
                  <Text style={subjectsStyles.assessStatusText}>
                    {t('subjects.noDataTracking', 'Sin registros para mostrar')}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {assessments.length === 0 ? (
        <View style={subjectsStyles.assessEmptyState}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={40} color="rgba(0,0,0,0.1)" style={{ marginBottom: 12 }} />
          <Text style={subjectsStyles.assessEmptyText}>
            {t('subjects.noAssessmentsMsg', 'Agrega evaluaciones para visualizar tu progreso académico')}
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={assessments}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            style={subjectsStyles.assessList}
            scrollEnabled={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={8}
            initialNumToRender={5}
            windowSize={5}
            renderItem={({ item: a, index }) => {
              const icon = ICON_MAP[a.type as string] || 'school-outline';
              const score = normalizeGrade(a);
              const color = BAR_COLORS[index % BAR_COLORS.length];

              return (
                <TouchableOpacity style={subjectsStyles.assessRow} activeOpacity={0.6}>
                  <View style={subjectsStyles.assessIcon}>
                    <MaterialCommunityIcons name={icon as any} size={18} color={color} />
                  </View>
                  <View style={subjectsStyles.assessBody}>
                    <Text style={subjectsStyles.assessName} numberOfLines={1}>{a.name}</Text>
                    <Text style={subjectsStyles.assessMeta}>{a.date || 'Sin fecha'}</Text>
                  </View>
                  <View style={subjectsStyles.assessRight}>
                    <Text style={[subjectsStyles.assessScore, { color: a.display_color || color }]}>
                      {score !== null && score !== undefined ? `${score.toFixed(1)}/${SCALE_MAX}` : '—'}
                    </Text>
                    {a.display_label && (
                      <View style={[subjectsStyles.assessScoreBadge, { backgroundColor: (a.display_color || color) + '20' }]}>
                        <Text style={[subjectsStyles.assessScoreLabel, { color: a.display_color || color }]}>≈ {a.display_label}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />

          <View style={subjectsStyles.sparklineContainer}>
            <Text style={subjectsStyles.sparklineLabel}>{t('subjects.performanceTrend')}</Text>
            <View style={subjectsStyles.sparklineWrapper}>
              <View style={subjectsStyles.sparklineYAxis}>
                <Text style={[subjectsStyles.yAxisLabel, { top: -6 }]}>5.0</Text>
                <Text style={[subjectsStyles.yAxisLabel, { top: 18 }]}>3.0</Text>
                <Text style={[subjectsStyles.yAxisLabel, { bottom: -6 }]}>0.0</Text>
              </View>
              <View style={[subjectsStyles.sparkline, subjectsStyles.sparklineMain]}>
                {assessments
                  .filter((a: any) => normalizeGrade(a) !== null)
                  .slice(-6)
                  .map((a: any, i: number, arr: any[]) => {
                    const scoreVal = normalizeGrade(a) ?? 0;
                    const barHeight = (scoreVal / SCALE_MAX) * 60;
                    const isLast = i === arr.length - 1;
                    const c = BAR_COLORS[assessments.indexOf(a) % BAR_COLORS.length];

                    return (
                      <View
                        key={a.id || i}
                        style={[
                          subjectsStyles.sparkBar,
                          { height: Math.max(barHeight, 2), backgroundColor: isLast ? c : c + '99' },
                        ]}
                      />
                    );
                  })}
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
};
