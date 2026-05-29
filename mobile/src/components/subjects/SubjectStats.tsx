import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { formatGrade } from '../../utils/grades';
import { theme } from '../../styles/theme';
import { subjectDetailStyles as globalSectionStyles } from '../../styles/SubjectDetail.styles';
import { globalStyles } from '../../styles/globalStyles';

interface SubjectStatsProps {
  averageGrade: number;
  projectedGrade: number;
  delta?: number;
  deliveredText: string;
  onPressInfo?: () => void;
}

/**
 * SubjectStats.tsx
 *
 * Un único card con 3 columnas separadas por líneas finas.
 * Muestra Promedio, Nota Proyectada (con badge de diferencia) y Tareas (con anillo de progreso).
 */
export const SubjectStats: React.FC<SubjectStatsProps> = ({
  averageGrade,
  projectedGrade,
  delta = 0,
  deliveredText,
  onPressInfo,
}) => {
  const { t } = useTranslation();

  // Parse deliveredText (ej. "3/5")
  const parts = deliveredText.split('/');
  const done = Number(parts[0]?.trim());
  const total = Number(parts[1]?.trim());
  const isValidTasks = !isNaN(done) && !isNaN(total) && total > 0;
  const taskPercent = isValidTasks ? Math.min(100, Math.max(0, (done / total) * 100)) : 0;

  // Tendencia: usar delta del backend si está disponible, sino calcular localmente
  const difference = delta || (projectedGrade - averageGrade);
  const isUp = difference > 0.01;
  const isDown = difference < -0.01;
  const differenceMagnitude = Math.abs(difference).toFixed(2);

  return (
    <View style={globalSectionStyles.sectionBlock}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={globalSectionStyles.sectionTitle}>
          {t('analytics.statsTitle')}
        </Text>
        {onPressInfo && (
          <TouchableOpacity onPress={onPressInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Card único con 3 columnas ─────────────────────────────── */}
      <View style={styles.card}>

        {/* Columna 1: Promedio */}
        <View style={styles.col}>
          <View style={styles.titleContainer}>
            <Ionicons name="calculator-outline" size={16} color="#007AFF" />
            <Text style={styles.colLabel}>{t('subjects.currentAverage')}</Text>
          </View>
          <View style={styles.contentContainer}>
            <Text style={styles.colValue}>{formatGrade(averageGrade)}</Text>
            <Text style={styles.colDenominator}>/5.0</Text>
          </View>
        </View>

        {/* Separador */}
        <View style={styles.separator} />

        {/* Columna 2: Proyectada */}
        <View style={styles.col}>
          <View style={styles.titleContainer}>
            <Ionicons 
              name="trending-up" 
              size={16} 
              color="#34C759" 
            />
            <Text style={styles.colLabel}>{t('subjects.projectedGrade')}</Text>
          </View>
          <View style={styles.contentContainer}>
            <View style={styles.projectedRow}>
              <Text style={styles.colValue}>{formatGrade(projectedGrade)}</Text>
              {isUp && <Ionicons name="arrow-up" size={14} color="#34C759" />}
              {isDown && <Ionicons name="arrow-down" size={14} color="#FF3B30" />}
            </View>
            {(isUp || isDown) && (
              <Text style={[styles.differenceText, { color: isUp ? '#34C759' : '#FF3B30' }]}>
                {isUp ? '+' : '-'}{differenceMagnitude} pts
              </Text>
            )}
          </View>
        </View>

        {/* Separador */}
        <View style={styles.separator} />

        {/* Columna 3: Tareas */}
        <View style={styles.col}>
          <View style={styles.titleContainer}>
            <Ionicons name="checkmark-circle" size={16} color="#FF9500" />
            <Text style={styles.colLabel}>{t('subjects.deliveredTasks')}</Text>
          </View>

          <View style={styles.contentContainer}>
            {isValidTasks ? (
              <View style={styles.circleProgressContainer}>
                <Svg width={60} height={60} viewBox="0 0 60 60" style={{ transform: [{ rotate: '-90deg' }] }}>
                  {/* Track de fondo */}
                  <Circle
                    cx="30"
                    cy="30"
                    r="24"
                    stroke="#FF9500"
                    strokeWidth="3"
                    fill="none"
                    opacity="0.15"
                  />
                  
                  {/* Arc de progreso */}
                  <Circle
                    cx="30"
                    cy="30"
                    r="24"
                    stroke="#FF9500"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${(taskPercent / 100) * 150.8} 150.8`}
                    strokeLinecap="round"
                  />
                </Svg>
                <View style={styles.circleProgressCenter}>
                  <Text style={styles.circleCounter}>{done}</Text>
                  <Text style={styles.circleCounter}>/</Text>
                  <Text style={styles.circleCounter}>{total}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.colValue}>{deliveredText}</Text>
            )}
          </View>
          <Text style={styles.tasksSubLabel}>{t('subjects.completedTasks')}</Text>
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 0,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  col: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  colLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.text.placeholder,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 4,
  },
  titleContainer: {
    alignItems: 'center',
    gap: 4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  colValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  colDenominator: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    letterSpacing: 0.3,
  },
  differenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 2,
  },
  differenceText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  projectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  separator: {
    width: 1,
    marginVertical: 14,
    backgroundColor: theme.colors.border,
  },
  circleProgressContainer: {
    width: 55,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  circleProgressOuter: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  circleProgressTrack: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 4,
    borderColor: '#FF9500',
    opacity: 0.15,
  },
  circleProgressSegment: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 4,
    borderColor: '#FF9500',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  circleProgressSegmentSecond: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 4,
    borderColor: '#FF9500',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
  },
  circleProgressCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 0,
  },

  circleCounter: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.text.primary,
  },
  circleCounterSub: {
    fontSize: 8,
    fontWeight: '600',
    color: theme.colors.text.placeholder,
  },
  tasksSubLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.colors.text.placeholder,
    marginTop: 0,
  },
});
