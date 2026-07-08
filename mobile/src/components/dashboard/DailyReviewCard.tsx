import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import type { PredictionItem } from '../../services/api/analytics';

const MINUTES_PER_CARD = 0.6;
const MAX_OTHER_SUBJECTS = 3;

interface DailyReviewSubject {
  subjectId: number;
  name: string;
  count: number;
  estimatedMinutes: number;
}

interface Props {
  cards: PredictionItem[];
  subjectNames: Record<number, string>;
  onStart: () => void;
}

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function DailyReviewCard({ cards, subjectNames, onStart }: Props) {
  const subjects = useMemo<DailyReviewSubject[]>(() => {
    const map: Record<number, number> = {};
    for (const c of cards) {
      map[c.subjectId] = (map[c.subjectId] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([id, count]) => ({
        subjectId: Number(id),
        name: subjectNames[Number(id)] ?? 'Materia',
        count,
        estimatedMinutes: Math.max(1, Math.round(count * MINUTES_PER_CARD)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [cards, subjectNames]);

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [cards.length, subjects.length, subjects[0]?.name]);

  const totalCards = cards.length;
  const subjectCount = subjects.length;
  const estimatedMinutes = Math.max(1, Math.round(totalCards * MINUTES_PER_CARD));

  const topSubject = subjects[0] ?? null;
  const otherSubjects = subjects.slice(1, 1 + MAX_OTHER_SUBJECTS);
  const remainingCount = subjects.length - 1 - MAX_OTHER_SUBJECTS;

  const footerText = useMemo(() => {
    const top2 = subjects.slice(0, 2).map(s => s.name);
    if (top2.length === 0) return 'Comenzar ahora reducirá el riesgo de olvido.';
    if (top2.length === 1) return `Esta sesión reducirá el riesgo de olvido en ${top2[0]}.`;
    return `Esta sesión reducirá el riesgo de olvido en ${top2[0]} y ${top2[1]}.`;
  }, [subjects]);

  if (totalCards === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="check-decagram" size={20} color={theme.colors.primary} importantForAccessibility="no" />
          <Text style={styles.title}>¡Todo al día!</Text>
        </View>
        <Text style={styles.emptyText}>
          No tienes repasos pendientes. Disfruta tu día o aprovecha para estudiar contenido nuevo.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header} accessible={true} accessibilityRole="header">
        <MaterialCommunityIcons name="book-open-variant" size={18} color={theme.colors.primary} importantForAccessibility="no" />
        <Text style={styles.title}>Repasos de hoy</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          <Text style={styles.statNumber}>{totalCards}</Text> {totalCards === 1 ? 'tarjeta' : 'tarjetas'}
        </Text>
        <Text style={styles.statSeparator}>•</Text>
        <Text style={styles.statText}>
          <Text style={styles.statNumber}>{subjectCount}</Text> {subjectCount === 1 ? 'materia' : 'materias'}
        </Text>
        <Text style={styles.statSeparator}>•</Text>
        <Text style={styles.statText}>
          <Text style={styles.statNumber}>≈{estimatedMinutes}</Text> min
        </Text>
      </View>

      {/* "Empieza por" */}
      {topSubject && (
        <View style={styles.topSubjectCard} accessible={true} accessibilityLabel={`Empieza por ${topSubject.name}, ${topSubject.count} ${topSubject.count === 1 ? 'tarjeta' : 'tarjetas'}, unos ${topSubject.estimatedMinutes} minutos`}>
          <View style={styles.topSubjectHeader}>
            <MaterialCommunityIcons name="target" size={13} color={theme.colors.primary} importantForAccessibility="no" />
            <Text style={styles.topSubjectLabel}>Empieza por</Text>
          </View>
          <View style={styles.topSubjectBody}>
            <Text style={styles.topSubjectName} numberOfLines={1}>{topSubject.name}</Text>
            <View style={styles.topSubjectMeta}>
              <Text style={styles.topSubjectPill}>{topSubject.count} {topSubject.count === 1 ? 'tarjeta' : 'tarjetas'}</Text>
              <Text style={styles.topSubjectTime}>≈{topSubject.estimatedMinutes} min</Text>
            </View>
          </View>
        </View>
      )}

      {/* Other subjects */}
      {otherSubjects.length > 0 && (
        <View style={styles.otherSection}>
          {otherSubjects.length > 1 && (
            <Text style={styles.otherSectionLabel}>Otras materias</Text>
          )}
          {otherSubjects.map(s => (
            <View key={s.subjectId} style={styles.subjectRow}>
              <View style={styles.subjectDot} />
              <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.subjectCount}>{s.count} {s.count === 1 ? 'tarjeta' : 'tarjetas'}</Text>
            </View>
          ))}
          {remainingCount > 0 && (
            <Text style={styles.moreSubjects}>+{remainingCount} más</Text>
          )}
        </View>
      )}

      <View style={styles.divider} />

      {/* Footer + CTA */}
      <View style={styles.footer}>
        <Text style={styles.footerHint} numberOfLines={2}>{footerText}</Text>
        <TouchableOpacity 
          style={styles.startBtn} 
          onPress={onStart} 
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Comenzar sesión de repaso"
        >
          <Text style={styles.startBtnText}>Comenzar</Text>
          <MaterialCommunityIcons name="arrow-right" size={15} color={theme.colors.white} importantForAccessibility="no" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    lineHeight: 20,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
  },
  statText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  statNumber: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.primary,
    fontWeight: '700',
  },
  statSeparator: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.border,
  },
  topSubjectCard: {
    backgroundColor: theme.colors.primary + '0D',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary + '25',
    padding: 12,
    marginBottom: 12,
  },
  topSubjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  topSubjectLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  topSubjectBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSubjectName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  topSubjectMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topSubjectPill: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  topSubjectTime: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  otherSection: {
    gap: 8,
    marginBottom: 14,
  },
  otherSectionLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.border,
    flexShrink: 0,
  },
  subjectName: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  subjectCount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  moreSubjects: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    marginLeft: 15,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerHint: {
    flex: 1,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    lineHeight: 17,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    flexShrink: 0,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  startBtnText: {
    color: theme.colors.white,
    fontWeight: '800',
    fontSize: theme.typography.sizes.md,
  },
});
