import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { type Subject } from '../../services/api';
import { SCALE_MAX } from '../../utils/grades';

export const SubjectTile = ({ subject }: { subject: Subject }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const rawAvg = typeof subject.avg_score === 'number' ? subject.avg_score : 0;
  const avg = rawAvg > SCALE_MAX * 2 ? (rawAvg / 100) * SCALE_MAX : rawAvg;
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
      <View style={globalStyles.flex1}>
        <Text style={styles.subjectTileName} numberOfLines={1}>{subject.name}</Text>
        <Text style={styles.subjectTileMeta} numberOfLines={1}>
          {subject.professor || t('dashboard.newSubject.noProfessor')}
        </Text>
        <Text style={styles.subjectTileStats}>
          {subject.display_label ? `≈ ${subject.display_label}` : t('dashboard.subjectCardAvg', { avg: avg.toFixed(1) })}
        </Text>
        <Text style={styles.subjectTileStats}>{t('dashboard.subjectCardCompletion', { completion: completion.toFixed(0) })}</Text>
      </View>
    </TouchableOpacity>
  );
};

export const MetricCard = ({ title, value, subtext, icon, color, showMood, onPress }: any) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showMood) {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, { 
              toValue: 1.3, 
              duration: 250, 
              easing: Easing.out(Easing.elastic(1)),
              useNativeDriver: true 
            }),
            Animated.timing(pulseOpacity, { 
              toValue: 0.6, 
              duration: 250, 
              easing: Easing.out(Easing.ease),
              useNativeDriver: true 
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, { 
              toValue: 1, 
              duration: 600, 
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true 
            }),
            Animated.timing(pulseOpacity, { 
              toValue: 1, 
              duration: 600, 
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true 
            }),
          ]),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(1);
    }
  }, [showMood, pulseAnim]);

  return (
    <TouchableOpacity 
      style={styles.metricCard} 
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        <Animated.View style={[
          styles.iconBox, 
          { backgroundColor: color + '20' },
          showMood && { transform: [{ scale: pulseAnim }], opacity: pulseOpacity }
        ]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </Animated.View>
      </View>
      <Text 
        style={styles.cardValue} 
        numberOfLines={1} 
        adjustsFontSizeToFit 
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text style={styles.cardSubtext} numberOfLines={1}>{subtext}</Text>
    </TouchableOpacity>
  );
};

export const ActionCircle = ({ title, icon, color, onPress }: any) => (
  <TouchableOpacity style={styles.actionItem} activeOpacity={0.65} onPress={onPress}>
    <View style={[styles.actionCircle, { backgroundColor: color + '08', borderColor: color + '20' }]}>
      <MaterialCommunityIcons name={icon as any} size={28} color={color} />
    </View>
    <Text style={styles.actionText}>{title}</Text>
  </TouchableOpacity>
);

export const PerformanceRow = ({ rank, name, gpa, icon, iconColor, isYou }: any) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.perfRow, isYou && styles.perfRowYou]}>
      <Text style={styles.perfRank}>#{rank}</Text>
      <View style={styles.perfUser}>
        <Ionicons name={icon as any} size={20} color={iconColor} style={globalStyles.mr8} />
        <Text style={[styles.perfName, isYou && { fontWeight: '600' }]}>{name}</Text>
      </View>
      <Text style={styles.perfGpa}>{t('dashboard.gpa')} {gpa}</Text>
    </View>
  );
};
