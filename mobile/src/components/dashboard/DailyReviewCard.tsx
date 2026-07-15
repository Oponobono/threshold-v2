import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { dailyReviewCardStyles } from '../../styles/DailyReviewCard.styles';
import type { PredictionItem } from '../../services/api/analytics';

const MINUTES_PER_CARD = 0.6;
const MAX_OTHER_SUBJECTS = 3;

interface DailyReviewSubject {
  subjectId: string;
  name: string;
  count: number;
  highUrgencyCount: number;
}

interface Props {
  cards: PredictionItem[];
  subjectNames: Record<string, string>;
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
    const map: Record<string, { count: number; highUrgencyCount: number }> = {};
    for (const c of cards) {
      const sId = String(c.subjectId);
      if (!map[sId]) map[sId] = { count: 0, highUrgencyCount: 0 };
      map[sId].count++;
      if (c.urgency === 'HIGH') map[sId].highUrgencyCount++;
    }
    return Object.entries(map)
      .map(([id, { count, highUrgencyCount }]) => ({
        subjectId: id,
        name: subjectNames[id] ?? 'Materia',
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
      <View style={dailyReviewCardStyles.card}>
        <View style={dailyReviewCardStyles.header}>
          <MaterialCommunityIcons name="check-decagram" size={20} color={theme.colors.primary} importantForAccessibility="no" />
          <Text style={dailyReviewCardStyles.title}>¡Todo al día!</Text>
        </View>
        <Text style={dailyReviewCardStyles.emptyText}>
          No tienes repasos pendientes. Disfruta tu día o aprovecha para estudiar contenido nuevo.
        </Text>
      </View>
    );
  }

  return (
    <View style={dailyReviewCardStyles.card}>
      {/* Header — título + scope badge */}
      <View style={dailyReviewCardStyles.header} accessible={true} accessibilityRole="header">
        <View style={dailyReviewCardStyles.headerLeft}>
          <MaterialCommunityIcons name="book-open-variant" size={18} color={theme.colors.primary} importantForAccessibility="no" />
          <Text style={dailyReviewCardStyles.title}>Sesión de hoy</Text>
        </View>
        <View style={dailyReviewCardStyles.headerBadge}>
          <Text style={dailyReviewCardStyles.headerBadgeText}>{totalCards} tarjetas · ≈{estimatedMinutes} min</Text>
        </View>
      </View>

      {/* Urgency alert — solo si hay tarjetas de alta urgencia */}
      {totalHighUrgency > 0 && (
        <View style={dailyReviewCardStyles.urgencyBanner}>
          <MaterialCommunityIcons name="alert-circle-outline" size={13} color={theme.colors.danger} importantForAccessibility="no" />
          <Text style={dailyReviewCardStyles.urgencyBannerText}>
            {totalHighUrgency} {totalHighUrgency === 1 ? 'tarjeta en riesgo alto de olvido' : 'tarjetas en riesgo alto de olvido'}
          </Text>
        </View>
      )}

      {/* Top subject — prioridad + señal de urgencia */}
      {topSubject && (
        <View
          style={dailyReviewCardStyles.topSubjectCard}
          accessible={true}
          accessibilityLabel={`${subjects.length === 1 ? 'Foco en' : 'Empieza por'} ${topSubject.name}, ${topSubject.count} ${topSubject.count === 1 ? 'tarjeta' : 'tarjetas'}`}
        >
          <View style={dailyReviewCardStyles.topSubjectHeader}>
            <MaterialCommunityIcons name="target" size={13} color={theme.colors.primary} importantForAccessibility="no" />
            <Text style={dailyReviewCardStyles.topSubjectLabel}>{subjects.length === 1 ? 'Foco en' : 'Empieza por'}</Text>
          </View>
          <View style={dailyReviewCardStyles.topSubjectBody}>
            <Text style={dailyReviewCardStyles.topSubjectName} numberOfLines={1}>{topSubject.name}</Text>
            <View style={dailyReviewCardStyles.topSubjectMeta}>
              <Text style={dailyReviewCardStyles.topSubjectPill}>{topSubject.count} {topSubject.count === 1 ? 'tarjeta' : 'tarjetas'}</Text>
              {topSubject.highUrgencyCount > 0 && (
                <View style={dailyReviewCardStyles.urgencyPill}>
                  <View style={dailyReviewCardStyles.urgencyDot} />
                  <Text style={dailyReviewCardStyles.urgencyPillText}>{topSubject.highUrgencyCount} urgente{topSubject.highUrgencyCount > 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Other subjects */}
      {otherSubjects.length > 0 && (
        <View style={dailyReviewCardStyles.otherSection}>
          {otherSubjects.length > 1 && (
            <Text style={dailyReviewCardStyles.otherSectionLabel}>Otras materias</Text>
          )}
          {otherSubjects.map(s => (
            <View key={s.subjectId} style={dailyReviewCardStyles.subjectRow}>
              <View style={[
                dailyReviewCardStyles.subjectDot,
                s.highUrgencyCount > 0 && dailyReviewCardStyles.subjectDotUrgent,
              ]} />
              <Text style={dailyReviewCardStyles.subjectName} numberOfLines={1}>{s.name}</Text>
              <Text style={dailyReviewCardStyles.subjectCount}>{s.count} {s.count === 1 ? 'tarjeta' : 'tarjetas'}</Text>
              {s.highUrgencyCount > 0 && (
                <Text style={dailyReviewCardStyles.subjectUrgencyHint}>{s.highUrgencyCount} urgente{s.highUrgencyCount > 1 ? 's' : ''}</Text>
              )}
            </View>
          ))}
          {remainingCount > 0 && (
            <Text style={dailyReviewCardStyles.moreSubjects}>+{remainingCount} más</Text>
          )}
        </View>
      )}

      <View style={dailyReviewCardStyles.divider} />

      {/* Footer + CTA */}
      <View style={dailyReviewCardStyles.footer}>
        <Text style={dailyReviewCardStyles.footerHint} numberOfLines={2}>{footerText}</Text>
        <TouchableOpacity
          style={dailyReviewCardStyles.startBtn}
          onPress={onStart}
          activeOpacity={0.8}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Comenzar sesión de repaso"
        >
          <Text style={dailyReviewCardStyles.startBtnText}>Comenzar</Text>
          <MaterialCommunityIcons name="arrow-right" size={15} color={theme.colors.white} importantForAccessibility="no" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

