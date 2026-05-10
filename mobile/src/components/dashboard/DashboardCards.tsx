import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { type Subject } from '../../services/api';

// ─── SubjectTile ──────────────────────────────────────────────────────────────
export const SubjectTile = React.memo(({ subject }: { subject: Subject }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const avg = typeof subject.avg_score === 'number' ? subject.avg_score : 0;
  const completion = typeof subject.completion_percent === 'number' ? subject.completion_percent : 0;

  return (
    <TouchableOpacity
      style={styles.subjectTile}
      activeOpacity={0.7}
      onPress={() => router.push(`/subjects/${subject.id}`)}
    >
      <View style={[styles.subjectBadge, { backgroundColor: subject.color || '#CCCCCC' }]}>
        <MaterialCommunityIcons name={(subject.icon as any) || 'book-outline'} size={20} color={theme.colors.text.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.subjectTileName} numberOfLines={1}>{subject.name}</Text>
        <Text style={styles.subjectTileMeta} numberOfLines={1}>
          {subject.professor || t('dashboard.newSubject.noProfessor')}
        </Text>
        <Text style={styles.subjectTileStats}>{t('dashboard.subjectCardAvg', { avg: avg.toFixed(1) })}</Text>
        <Text style={styles.subjectTileStats}>{t('dashboard.subjectCardCompletion', { completion: completion.toFixed(0) })}</Text>
      </View>
    </TouchableOpacity>
  );
});
SubjectTile.displayName = 'SubjectTile';

// ─── MetricCard ───────────────────────────────────────────────────────────────
export const MetricCard = React.memo(({ title, value, subtext, icon, color, showMood, onPress }: any) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showMood) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [showMood, pulseAnim]);

  return (
    <TouchableOpacity style={styles.metricCard} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        <Animated.View style={[styles.iconBox, { backgroundColor: color + '20' }, showMood && { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name={icon} size={20} color={color} />
        </Animated.View>
      </View>
      <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={styles.cardSubtext} numberOfLines={1}>{subtext}</Text>
    </TouchableOpacity>
  );
});
MetricCard.displayName = 'MetricCard';

// ─── ActionCircle ─────────────────────────────────────────────────────────────
export const ActionCircle = React.memo(({ title, icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.actionItem} activeOpacity={0.65} onPress={onPress}>
    <View style={[styles.actionCircle, { backgroundColor: color + '08', borderColor: color + '20' }]}>
      <MaterialCommunityIcons name={icon} size={28} color={color} />
    </View>
    <Text style={styles.actionText}>{title}</Text>
  </TouchableOpacity>
));
ActionCircle.displayName = 'ActionCircle';

// ─── PerformanceRow ───────────────────────────────────────────────────────────
export const PerformanceRow = React.memo(({ rank, name, gpa, icon, iconColor, isYou }: any) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.perfRow, isYou && styles.perfRowYou]}>
      <Text style={styles.perfRank}>#{rank}</Text>
      <View style={styles.perfUser}>
        <Ionicons name={icon} size={20} color={iconColor} style={{ marginRight: 8 }} />
        <Text style={[styles.perfName, isYou && { fontWeight: '600' }]}>{name}</Text>
      </View>
      <Text style={styles.perfGpa}>{t('dashboard.gpa')} {gpa}</Text>
    </View>
  );
});
PerformanceRow.displayName = 'PerformanceRow';
