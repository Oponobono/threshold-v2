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
  highUrgencyCount: number;
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
    const map: Record<number, { count: number; highUrgencyCount: number }> = {};
    for (const c of cards) {
      if (!map[c.subjectId]) map[c.subjectId] = { count: 0, highUrgencyCount: 0 };
      map[c.subjectId].count++;
      if (c.urgency === 'HIGH') map[c.subjectId].highUrgencyCount++;
    }
    return Object.entries(map)
      .map(([id, { count, highUrgencyCount }]) => ({
        subjectId: Number(id),
        name: subjectNames[Number(id)] ?? 'Materia',
        count,
        highUrgencyCount,
      }))
      .sort((a, b) => b.highUrgencyCount - a.highUrgencyCount || b.count - a.count);
  }, [cards, subjectNames]);

  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [cards.length, subjects.length, subjects[0]?.name]);

  const totalCards = cards.length;
  const estimatedMinutes = Math.max(1, Math.round(totalCards * MINUTES_PER_CARD));
  const totalHighUrgency = cards.filter(c => c.urgency === 'HIGH').length;

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
      {/* Header — título + scope badge */}
      <View style={styles.header} accessible={true} accessibilityRole="header">
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="book-open-variant" size={18} color={theme.colors.primary} importantForAccessibility="no" />
          <Text style={styles.title}>Sesión de hoy</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{totalCards} tarjetas · ≈{estimatedMinutes} min</Text>
        </View>
      </View>

      {/* Urgency alert — solo si hay tarjetas de alta urgencia */}
      {totalHighUrgency > 0 && (
        <View style={styles.urgencyBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={13} color={theme.colors.danger} importantForAccessibility="no" />
          <Text style={styles.urgencyBannerText}>
            {totalHighUrgency} {totalHighUrgency === 1 ? 'tarjeta en riesgo alto de olvido' : 'tarjetas en riesgo alto de olvido'}
          </Text>
        </View>
      )}

      {/* Top subject — prioridad + señal de urgencia */}
      {topSubject && (
        <View
          style={styles.topSubjectCard}
          accessible={true}
          accessibilityLabel={`${subjects.length === 1 ? 'Foco en' : 'Empieza por'} ${topSubject.name}, ${topSubject.count} ${topSubject.count === 1 ? 'tarjeta' : 'tarjetas'}`}
        >
          <View style={styles.topSubjectHeader}>
            <MaterialCommunityIcons name="target" size={13} color={theme.colors.primary} importantForAccessibility="no" />
            <Text style={styles.topSubjectLabel}>{subjects.length === 1 ? 'Foco en' : 'Empieza por'}</Text>
          </View>
          <View style={styles.topSubjectBody}>
            <Text style={styles.topSubjectName} numberOfLines={1}>{topSubject.name}</Text>
            <View style={styles.topSubjectMeta}>
              <Text style={styles.topSubjectPill}>{topSubject.count} {topSubject.count === 1 ? 'tarjeta' : 'tarjetas'}</Text>
              {topSubject.highUrgencyCount > 0 && (
                <View style={styles.urgencyPill}>
                  <View style={styles.urgencyDot} />
                  <Text style={styles.urgencyPillText}>{topSubject.highUrgencyCount} urgente{topSubject.highUrgencyCount > 1 ? 's' : ''}</Text>
                </View>
              )}
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
              <View style={[
                styles.subjectDot,
                s.highUrgencyCount > 0 && styles.subjectDotUrgent,
              ]} />
              <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.subjectCount}>{s.count} {s.count === 1 ? 'tarjeta' : 'tarjetas'}</Text>
              {s.highUrgencyCount > 0 && (
                <Text style={styles.subjectUrgencyHint}>{s.highUrgencyCount} urgente{s.highUrgencyCount > 1 ? 's' : ''}</Text>
              )}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  headerBadge: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerBadgeText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    lineHeight: 20,
    marginTop: 4,
  },
  urgencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.dangerTransparent,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  urgencyBannerText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.danger,
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
  urgencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.dangerTransparent,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  urgencyDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.danger,
  },
  urgencyPillText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.danger,
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
  subjectDotUrgent: {
    backgroundColor: theme.colors.danger,
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
  subjectUrgencyHint: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: theme.colors.danger,
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
