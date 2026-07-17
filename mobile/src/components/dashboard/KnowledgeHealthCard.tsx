import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { knowledgeHealthCardStyles as styles } from '../../styles/KnowledgeHealthCard.styles';
import { RingGauge } from './RingGauge';
import { AutoScrollText } from '../ui/AutoScrollText';
import { computeMaturity } from '../../domain/knowledge/stage';
import type { KnowledgeSnapshot, SubjectKnowledge } from '../../domain/knowledge/types';
import { getMemoryLevelLabel, getKnowledgeDescription, getRiskLabel, getLastReviewLabel } from '../../presentation/knowledge/labels';

const SkeletonBar: React.FC<{ width: string | number; height?: number; style?: any }> = ({ width, height = 12, style }) => (
  <View style={[{ width, height, borderRadius: 6, backgroundColor: theme.colors.border, opacity: 0.5 }, style]} />
);

export function KnowledgeHealthCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="brain" size={20} color={theme.colors.text.secondary} />
        <SkeletonBar width={120} height={16} />
      </View>
      <View style={styles.estadoRow}>
        <SkeletonBar width={88} height={88} style={{ borderRadius: 44 }} />
        <View style={styles.estadoInfo}>
          <SkeletonBar width="60%" height={20} />
          <SkeletonBar width="80%" height={12} style={{ marginTop: 6 }} />
          <SkeletonBar width="50%" height={10} style={{ marginTop: 4 }} />
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.metricsRow}>
        <View style={styles.metricCol}>
          <SkeletonBar width={60} height={10} />
          <SkeletonBar width={40} height={20} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricCol}>
          <SkeletonBar width={60} height={10} />
          <SkeletonBar width={40} height={20} style={{ marginTop: 4 }} />
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricCol}>
          <SkeletonBar width={60} height={10} />
          <SkeletonBar width={40} height={20} style={{ marginTop: 4 }} />
        </View>
      </View>
      <View style={styles.divider} />
      <SkeletonBar width="70%" height={10} style={{ alignSelf: 'center' }} />
    </View>
  );
}

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
  snapshot: KnowledgeSnapshot | null;
  loading?: boolean;
}

export function KnowledgeHealthCard({ snapshot, loading }: Props) {
  const { t } = useTranslation();
  const subjects = snapshot?.subjects ?? [];

  const prioridad = useMemo<SubjectKnowledge | null>(() => {
    const active = subjects.filter((s: SubjectKnowledge) => s.totalCards > 0);
    if (active.length === 0) return null;
    return active.reduce((a, b) => a.retrievability < b.retrievability ? a : b);
  }, [subjects]);

  const masSolida = useMemo<SubjectKnowledge | null>(() => {
    const active = subjects.filter((s: SubjectKnowledge) => s.totalCards > 0);
    if (active.length === 0) return null;
    return active.reduce((a, b) => a.retrievability > b.retrievability ? a : b);
  }, [subjects]);

  const consolidado = useMemo(() => {
    const total = subjects.reduce((s: number, sub: SubjectKnowledge) => s + sub.totalCards, 0);
    if (total === 0) return 0;
    const mastered = subjects.reduce((s: number, sub: SubjectKnowledge) => s + sub.masteredCards, 0);
    return Math.round((mastered / total) * 100);
  }, [subjects]);

  const health = snapshot?.health;
  const metadata = snapshot?.metadata;
  const mainColor = health ? scoreColor(health.score) : theme.colors.text.secondary;
  const descripcion = useMemo(() => health ? getKnowledgeDescription(health.score, t) : '', [health, t]);
  const lastReviewLabel = useMemo(() => metadata ? getLastReviewLabel(metadata.daysSinceLastReview, t) : '', [metadata, t]);
  const showSubjects = prioridad && masSolida && prioridad.subjectId !== masSolida.subjectId;

  if (loading || !snapshot) {
    return <KnowledgeHealthCardSkeleton />;
  }

  return (
    <KnowledgeHealthCardContent
      snapshot={snapshot}
      t={t}
      mainColor={mainColor}
      prioridad={prioridad}
      masSolida={masSolida}
      consolidado={consolidado}
      descripcion={descripcion}
      lastReviewLabel={lastReviewLabel}
      showSubjects={!!showSubjects}
    />
  );
}

function KnowledgeHealthCardContent({ snapshot, t, mainColor, prioridad, masSolida, consolidado, descripcion, lastReviewLabel, showSubjects }: {
  snapshot: KnowledgeSnapshot;
  t: any;
  mainColor: string;
  prioridad: SubjectKnowledge | null;
  masSolida: SubjectKnowledge | null;
  consolidado: number;
  descripcion: string;
  lastReviewLabel: string;
  showSubjects: boolean;
}) {
  const { health, metadata } = snapshot;

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
          <Text style={styles.estadoMeta}>{lastReviewLabel}</Text>
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
            <AutoScrollText
              text={prioridad!.subjectName}
              style={styles.subjectName}
              lineHeight={20}
            />
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
            <AutoScrollText
              text={masSolida!.subjectName}
              style={styles.subjectName}
              lineHeight={20}
            />
            <Text style={[styles.subjectDetail, { color: '#30D158' }]}>
              {Math.round(masSolida!.retrievability)}% {t('knowledge.labels.consolidated').toLowerCase()}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.metaText}>
        {t('knowledge.labels.evaluatedOn', { cards: formatNumber(metadata.totalCards), subjects: metadata.totalSubjects })}
      </Text>

      <View style={styles.divider} />
      <Text style={styles.footerText}>
        {getRiskLabel(health.knowledgeAtRisk, health.score, t)}
      </Text>
    </View>
  );
}

