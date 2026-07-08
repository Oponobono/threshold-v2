import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import { RingGauge } from './RingGauge';
import { computeMaturity } from '../../domain/knowledge/stage';
import type { KnowledgeSnapshot, SubjectKnowledge } from '../../domain/knowledge/types';
import { getMemoryLevelLabel, getKnowledgeDescription, getRiskLabel } from '../../presentation/knowledge/labels';

function scoreColor(score: number): string {
  if (score >= 90) return '#34C759';
  if (score >= 75) return '#30D158';
  if (score >= 60) return '#FF9500';
  if (score >= 40) return '#FF6347';
  return '#FF2D55';
}



function forgettingRiskColor(risk: string): string {
  switch (risk) {
    case 'high': return '#FF2D55';
    case 'medium': return '#FF9500';
    default: return '#34C759';
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('es-ES');
}

interface Props {
  snapshot: KnowledgeSnapshot;
}

export function KnowledgeHealthCard({ snapshot }: Props) {
  const { t } = useTranslation();
  const { health, metadata, subjects } = snapshot;
  const mainColor = scoreColor(health.score);

  const prioridad = useMemo<SubjectKnowledge | null>(() => {
    const active = subjects.filter(s => s.totalCards > 0);
    if (active.length === 0) return null;
    return active.reduce((a, b) => a.retrievability < b.retrievability ? a : b);
  }, [subjects]);

  const masSolida = useMemo<SubjectKnowledge | null>(() => {
    const active = subjects.filter(s => s.totalCards > 0);
    if (active.length === 0) return null;
    return active.reduce((a, b) => a.retrievability > b.retrievability ? a : b);
  }, [subjects]);

  const consolidado = useMemo(() => {
    const total = subjects.reduce((s, sub) => s + sub.totalCards, 0);
    if (total === 0) return 0;
    const mastered = subjects.reduce((s, sub) => s + sub.masteredCards, 0);
    return Math.round((mastered / total) * 100);
  }, [subjects]);

  const maturity = useMemo(() => computeMaturity(consolidado), [consolidado]);
  const descripcion = useMemo(() => getKnowledgeDescription(maturity, health.score, t), [maturity, health.score, t]);
  const showSubjects = prioridad && masSolida && prioridad.subjectId !== masSolida.subjectId;

  return (
    <View style={styles.card}>
      {/* ── Block 1: Estado ── */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="brain" size={20} color={theme.colors.primary} />
        <Text style={styles.title}>{t('knowledge.labels.title')}</Text>
      </View>

      <View style={styles.estadoRow}>
        <RingGauge value={health.score} color={mainColor} size={88} strokeWidth={7}>
          <Text style={[styles.ringPercent, { color: mainColor }]}>
            {Math.round(health.score)}%
          </Text>
        </RingGauge>
        <View style={styles.estadoInfo}>
          <Text style={[styles.levelText, { color: mainColor }]}>
            {getMemoryLevelLabel(health.memoryLevel, t)}
          </Text>
          <Text style={styles.estadoDesc}>{descripcion}</Text>
          <Text style={styles.estadoLabel}>{t('knowledge.labels.generalState')}</Text>
        </View>
      </View>

      {/* ── Block 2: Diagnóstico ── */}
      <View style={styles.divider} />
      <View style={styles.metricsRow}>
        <View style={styles.metricCol}>
          <View style={styles.metricLabelRow}>
            <MaterialCommunityIcons name="fire" size={16} color="#FF6347" />
            <Text style={styles.metricLabel}>{t('knowledge.labels.atRiskToday')}</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#FF6347' }]}>
            {health.knowledgeAtRisk}%
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <View style={styles.metricLabelRow}>
            <MaterialCommunityIcons name="chart-line" size={16} color={theme.colors.primary} />
            <Text style={styles.metricLabel}>{t('knowledge.labels.confidence')}</Text>
          </View>
          <Text style={[styles.metricValue, { color: theme.colors.primary }]}>
            {Math.round(health.confidence * 100)}%
          </Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricCol}>
          <View style={styles.metricLabelRow}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#30D158" />
            <Text style={styles.metricLabel}>{t('knowledge.labels.consolidated')}</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#30D158' }]}>
            {consolidado}%
          </Text>
        </View>
      </View>

      {showSubjects && (
        <View style={styles.subjectsRow}>
          <View style={styles.subjectCol}>
            <View style={styles.subjectLabelRow}>
              <MaterialCommunityIcons name="target" size={15} color="#FF6347" />
              <Text style={styles.subjectLabel}>{t('knowledge.labels.todayPriority')}</Text>
            </View>
            <Text style={styles.subjectName}>{prioridad!.subjectName}</Text>
            <Text style={[styles.subjectDetail, { color: forgettingRiskColor(prioridad!.risk) }]}>
              {Math.round(prioridad!.retrievability)}% · {prioridad!.dueCards} {t('knowledge.labels.pending')}
            </Text>
          </View>
          <View style={styles.subjectDivider} />
          <View style={styles.subjectCol}>
            <View style={styles.subjectLabelRow}>
              <MaterialCommunityIcons name="trophy" size={15} color="#30D158" />
              <Text style={styles.subjectLabel}>{t('knowledge.labels.mostSolid')}</Text>
            </View>
            <Text style={styles.subjectName}>{masSolida!.subjectName}</Text>
            <Text style={[styles.subjectDetail, { color: '#30D158' }]}>
              {Math.round(masSolida!.retrievability)}% {t('knowledge.labels.consolidated').toLowerCase()}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.metaText}>
        {t('knowledge.labels.evaluatedOn', { cards: formatNumber(metadata.totalCards), subjects: metadata.totalSubjects })}
      </Text>

      {/* ── Block 3: Interpretación ── */}
      <View style={styles.divider} />
      <Text style={styles.footerText}>
        {getRiskLabel(health.knowledgeAtRisk, t)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...globalStyles.shadow as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  estadoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  estadoInfo: {
    flex: 1,
    gap: 2,
  },
  levelText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  estadoDesc: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  estadoLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '400',
    color: theme.colors.text.secondary,
    opacity: 0.7,
    marginTop: 2,
  },
  ringPercent: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  metricValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '800',
  },
  metricDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border,
    marginHorizontal: 8,
  },
  subjectsRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  subjectCol: {
    flex: 1,
    gap: 2,
  },
  subjectLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  subjectLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  subjectName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  subjectDetail: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
  },
  subjectDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 10,
  },
  metaText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  footerText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    lineHeight: 18,
    textAlign: 'center',
  },
});
