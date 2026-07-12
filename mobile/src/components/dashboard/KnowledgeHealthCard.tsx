import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { knowledgeHealthCardStyles } from '../../styles/KnowledgeHealthCard.styles';
import { RingGauge } from './RingGauge';
import { computeMaturity } from '../../domain/knowledge/stage';
import type { KnowledgeSnapshot, SubjectKnowledge } from '../../domain/knowledge/types';
import { getMemoryLevelLabel, getKnowledgeDescription, getRiskLabel, getLastReviewLabel } from '../../presentation/knowledge/labels';

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

  const descripcion = useMemo(() => getKnowledgeDescription(health.score, t), [health.score, t]);
  const lastReviewLabel = useMemo(() => getLastReviewLabel(metadata.daysSinceLastReview, t), [metadata.daysSinceLastReview, t]);
  const showSubjects = prioridad && masSolida && prioridad.subjectId !== masSolida.subjectId;

  return (
    <View style={knowledgeHealthCardStyles.card}>
      {/* ── Block 1: Estado ── */}
      <View style={knowledgeHealthCardStyles.header}>
        <MaterialCommunityIcons name="brain" size={20} color={theme.colors.primary} />
        <Text style={knowledgeHealthCardStyles.title}>{t('knowledge.labels.title')}</Text>
      </View>

      <View style={knowledgeHealthCardStyles.estadoRow}>
        <RingGauge value={health.score} color={mainColor} size={88} strokeWidth={7}>
          <Text style={[knowledgeHealthCardStyles.ringPercent, { color: mainColor }]}>
            {Math.round(health.score)}%
          </Text>
        </RingGauge>
        <View style={knowledgeHealthCardStyles.estadoInfo}>
          <Text style={[knowledgeHealthCardStyles.levelText, { color: mainColor }]}>
            {getMemoryLevelLabel(health.memoryLevel, t)}
          </Text>
          <Text style={knowledgeHealthCardStyles.estadoDesc}>{descripcion}</Text>
          <Text style={knowledgeHealthCardStyles.estadoMeta}>{lastReviewLabel}</Text>
        </View>
      </View>

      {/* ── Block 2: Diagnóstico ── */}
      <View style={knowledgeHealthCardStyles.divider} />
      <View style={knowledgeHealthCardStyles.metricsRow}>
        <View style={knowledgeHealthCardStyles.metricCol}>
          <View style={knowledgeHealthCardStyles.metricLabelRow}>
            <MaterialCommunityIcons name="fire" size={16} color="#FF6347" />
            <Text style={knowledgeHealthCardStyles.metricLabel}>{t('knowledge.labels.atRiskToday')}</Text>
          </View>
          <Text style={[knowledgeHealthCardStyles.metricValue, { color: '#FF6347' }]}>
            {health.knowledgeAtRisk}%
          </Text>
        </View>

        <View style={knowledgeHealthCardStyles.metricDivider} />

        <View style={knowledgeHealthCardStyles.metricCol}>
          <View style={knowledgeHealthCardStyles.metricLabelRow}>
            <MaterialCommunityIcons name="chart-line" size={16} color={theme.colors.primary} />
            <Text style={knowledgeHealthCardStyles.metricLabel}>{t('knowledge.labels.confidence')}</Text>
          </View>
          <Text style={[knowledgeHealthCardStyles.metricValue, { color: theme.colors.primary }]}>
            {Math.round(health.confidence * 100)}%
          </Text>
        </View>

        <View style={knowledgeHealthCardStyles.metricDivider} />

        <View style={knowledgeHealthCardStyles.metricCol}>
          <View style={knowledgeHealthCardStyles.metricLabelRow}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#30D158" />
            <Text style={knowledgeHealthCardStyles.metricLabel}>{t('knowledge.labels.consolidated')}</Text>
          </View>
          <Text style={[knowledgeHealthCardStyles.metricValue, { color: '#30D158' }]}>
            {consolidado}%
          </Text>
        </View>
      </View>

      {showSubjects && (
        <View style={knowledgeHealthCardStyles.subjectsRow}>
          <View style={knowledgeHealthCardStyles.subjectCol}>
            <View style={knowledgeHealthCardStyles.subjectLabelRow}>
              <MaterialCommunityIcons name="target" size={15} color="#FF6347" />
              <Text style={knowledgeHealthCardStyles.subjectLabel}>{t('knowledge.labels.todayPriority')}</Text>
            </View>
            <Text style={knowledgeHealthCardStyles.subjectName}>{prioridad!.subjectName}</Text>
            <Text style={[knowledgeHealthCardStyles.subjectDetail, { color: forgettingRiskColor(prioridad!.risk) }]}>
              {Math.round(prioridad!.retrievability)}% · {prioridad!.dueCards} {t('knowledge.labels.pending')}
            </Text>
          </View>
          <View style={knowledgeHealthCardStyles.subjectDivider} />
          <View style={knowledgeHealthCardStyles.subjectCol}>
            <View style={knowledgeHealthCardStyles.subjectLabelRow}>
              <MaterialCommunityIcons name="trophy" size={15} color="#30D158" />
              <Text style={knowledgeHealthCardStyles.subjectLabel}>{t('knowledge.labels.mostSolid')}</Text>
            </View>
            <Text style={knowledgeHealthCardStyles.subjectName}>{masSolida!.subjectName}</Text>
            <Text style={[knowledgeHealthCardStyles.subjectDetail, { color: '#30D158' }]}>
              {Math.round(masSolida!.retrievability)}% {t('knowledge.labels.consolidated').toLowerCase()}
            </Text>
          </View>
        </View>
      )}

      <Text style={knowledgeHealthCardStyles.metaText}>
        {t('knowledge.labels.evaluatedOn', { cards: formatNumber(metadata.totalCards), subjects: metadata.totalSubjects })}
      </Text>

      <View style={knowledgeHealthCardStyles.divider} />
      <Text style={knowledgeHealthCardStyles.footerText}>
        {getRiskLabel(health.knowledgeAtRisk, health.score, t)}
      </Text>
    </View>
  );
}

