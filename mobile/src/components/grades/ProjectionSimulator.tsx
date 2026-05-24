import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { theme } from '../../styles/theme';
import { gradesStyles } from '../../styles/Grades.styles';

interface ProjectionSimulatorProps {
  simScore: string;
  simPossible: string;
  projectedGpa: string | null;
  trendSeries: number[];
  chartWidth: number;
  termGpa: string;
  gradedAssessmentsLength: number;
  historicalGpasLength: number;
  onScoreChange: (val: string) => void;
  onPossibleChange: (val: string) => void;
  onRunSim: () => void;
  onReset: () => void;
  onPressInfo: () => void;
  onExpand?: () => void;
  t: any;
}

export const ProjectionSimulator: React.FC<ProjectionSimulatorProps> = ({
  simScore,
  simPossible,
  projectedGpa,
  trendSeries,
  chartWidth,
  termGpa,
  gradedAssessmentsLength,
  historicalGpasLength,
  onScoreChange,
  onPossibleChange,
  onRunSim,
  onReset,
  onPressInfo,
  onExpand,
  t,
}) => {
  return (
    <View style={gradesStyles.card}>
      <View style={gradesStyles.projectionHeaderRow}>
        <Text style={gradesStyles.sectionTitle}>{t('grades.projectionsSim')}</Text>
        <TouchableOpacity onPress={onPressInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <Text style={gradesStyles.descText}>{t('grades.projectionsDesc')}</Text>

      <View style={gradesStyles.simInputRow}>
        <View style={gradesStyles.simInputWrapper}>
          <Text style={gradesStyles.simInputLabel}>{t('grades.scoreLabel', 'Nota')}</Text>
          <TextInput
            style={gradesStyles.simInput}
            placeholder="0"
            placeholderTextColor={theme.colors.text.placeholder}
            keyboardType="numeric"
            value={simScore}
            onChangeText={onScoreChange}
          />
        </View>
        <View style={gradesStyles.simInputWrapper}>
          <Text style={gradesStyles.simInputLabel}>{t('grades.weightLabel', 'Peso (%)')}</Text>
          <TextInput
            style={gradesStyles.simInput}
            placeholder="0"
            placeholderTextColor={theme.colors.text.placeholder}
            keyboardType="numeric"
            value={simPossible}
            onChangeText={onPossibleChange}
          />
        </View>
        <TouchableOpacity style={gradesStyles.simAddBtn} onPress={onRunSim}>
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={gradesStyles.simChartCard}>
        <TouchableOpacity activeOpacity={0.9} onPress={onExpand}>
          <LineChart
            data={{
              labels: trendSeries.map((_, i) => {
                if (i === trendSeries.length - 1) return 'Proy.';
                if (gradedAssessmentsLength === 0) return '';
                if (gradedAssessmentsLength === 1) return i === 0 ? '0' : '1';
                const startIndex = gradedAssessmentsLength - historicalGpasLength;
                return `${startIndex + i + 1}`;
              }),
              datasets: [{
                data: trendSeries,
                color: () => theme.colors.text.primary,
                strokeWidth: 2.8,
              }],
            }}
            width={chartWidth}
            height={160}
            withDots={true}
            getDotColor={(_, index) =>
              (index === trendSeries.length - 1 && projectedGpa) ? '#FF9500' : theme.colors.primary
            }
            withShadow={false}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            withInnerLines={true}
            withOuterLines={true}
            bezier={true}
            fromZero={false}
            yAxisSuffix=""
            yAxisInterval={1}
            chartConfig={{
              backgroundColor: '#EEF4FA',
              backgroundGradientFrom: '#EEF4FA',
              backgroundGradientTo: '#EEF4FA',
              decimalPlaces: 1,
              color: () => theme.colors.primary,
              labelColor: () => theme.colors.text.secondary,
              style: { borderRadius: 16, paddingRight: 20 },
              propsForDots: { r: "4", strokeWidth: "2", stroke: '#EEF4FA' },
              propsForBackgroundLines: { strokeWidth: 1, strokeDasharray: "4", stroke: theme.colors.border || '#e0e0e0' },
              propsForLabels: { fontSize: 10 },
            }}
            style={gradesStyles.simChart}
          />
        </TouchableOpacity>
      </View>

      <View style={gradesStyles.currentProjectionCentered}>
        <Text style={gradesStyles.currentProjectionLine} numberOfLines={1}>
          <Text style={gradesStyles.currentProjectionLabel}>{t('grades.currentProjection')} </Text>
          <Text style={gradesStyles.currentProjectionValue}>{termGpa}</Text>
        </Text>
      </View>

      {projectedGpa && (
        <View style={gradesStyles.simSummary}>
          <Text style={gradesStyles.simSummaryText}>{t('grades.simSummary')}</Text>
          <Text style={gradesStyles.projGpaText}>
            {t('grades.projectedTermGpa')} <Text style={{ color: '#34C759', fontWeight: '900' }}>{projectedGpa}</Text>
          </Text>
        </View>
      )}

      <View style={gradesStyles.simActions}>
        <TouchableOpacity style={gradesStyles.simActionPrimary} onPress={onRunSim}>
          <Text style={gradesStyles.simActionPrimaryText}>{t('grades.run')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={gradesStyles.simActionSecondary} onPress={onReset}>
          <Text style={gradesStyles.simActionSecondaryText}>{t('grades.reset')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
