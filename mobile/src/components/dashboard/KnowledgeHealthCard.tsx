import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { globalStyles } from '../../styles/globalStyles';
import type { KnowledgeSnapshot, MemoryLevel, ForgettingRisk } from '../../domain/knowledge/types';

function scoreColor(score: number): string {
  if (score >= 90) return '#34C759';
  if (score >= 75) return '#30D158';
  if (score >= 60) return '#FF9500';
  if (score >= 40) return '#FF6347';
  return '#FF2D55';
}

function memoryLevelLabel(level: MemoryLevel): string {
  switch (level) {
    case 'excellent': return 'Excelente memoria';
    case 'good': return 'Buena memoria';
    case 'recovering': return 'Recuperándose';
    case 'critical': return 'Memoria crítica';
  }
}

function forgettingRiskIcon(risk: ForgettingRisk): { icon: string; color: string; label: string } {
  switch (risk) {
    case 'low': return { icon: 'shield-check', color: '#34C759', label: 'Bajo' };
    case 'medium': return { icon: 'shield-alert', color: '#FF9500', label: 'Medio' };
    case 'high': return { icon: 'shield-remove', color: '#FF2D55', label: 'Alto' };
  }
}

function formatAge(age: string): string {
  switch (age) {
    case 'fresh': return 'segundos';
    case 'recent': return 'minutos';
    case 'stale': return '> 1 hora';
    case 'expired': return '> 1 hora';
  }
}

interface Props {
  snapshot: KnowledgeSnapshot;
}

export function KnowledgeHealthCard({ snapshot }: Props) {
  const { health, metadata } = snapshot;
  const barColor = scoreColor(health.score);
  const barWidth = Math.min(100, health.score);
  const risk = forgettingRiskIcon(health.forgettingRisk);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="brain" size={20} color={theme.colors.primary} />
        <Text style={styles.title}>Estado de Aprendizaje</Text>
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={[styles.scoreValue, { color: barColor }]}>
          {Math.round(health.score)}%
        </Text>
        <Text style={[styles.scoreLabel, { color: barColor }]}>
          {memoryLevelLabel(health.memoryLevel)}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
      </View>

      {/* Confidence */}
      <View style={styles.confidenceRow}>
        <Text style={styles.confidenceText}>
          Confianza: {Math.round(health.confidence * 100)}%
        </Text>
      </View>

      {/* Risk */}
      <View style={styles.divider} />
      <View style={styles.riskRow}>
        <MaterialCommunityIcons name={risk.icon as any} size={22} color={risk.color} />
        <View style={styles.riskTextCol}>
          <Text style={[styles.riskLabel, { color: risk.color }]}>
            Riesgo de olvido: {risk.label}
          </Text>
          <Text style={styles.riskDetail}>
            {health.knowledgeAtRisk}% del conocimiento consolidado{'\n'}
            entrará en zona de olvido si hoy no estudias.
          </Text>
        </View>
      </View>

      {/* Metadata */}
      <View style={styles.divider} />
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaValue}>{metadata.totalCards}</Text>
          <Text style={styles.metaLabel}>Tarjetas</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaValue}>{metadata.totalSubjects}</Text>
          <Text style={styles.metaLabel}>Materias</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaValue}>{formatAge(snapshot.age)}</Text>
          <Text style={styles.metaLabel}>Actualizado</Text>
        </View>
      </View>
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
    marginBottom: 14,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
  },
  scoreLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#E8E8ED',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceRow: {
    marginBottom: 2,
  },
  confidenceText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  riskRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  riskTextCol: {
    flex: 1,
  },
  riskLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  riskDetail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  metaLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
});
