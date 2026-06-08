import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Pressable, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { type Subject } from '../../services/api';
import { SCALE_MAX } from '../../utils/grades';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

interface SubjectTileProps {
  subject: Subject;
  onEdit?: (subject: Subject) => void;
  onDelete?: (subject: Subject) => void;
}

export const SubjectTile = ({ subject, onEdit, onDelete }: SubjectTileProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const rawAvg = typeof subject.avg_score === 'number' ? subject.avg_score : 0;
  const avg = rawAvg > SCALE_MAX * 2 ? (rawAvg / 100) * SCALE_MAX : rawAvg;
  const completion = typeof subject.completion_percent === 'number' ? subject.completion_percent : 0;

  return (
    <View style={{ overflow: 'visible' }}>
      <TouchableOpacity 
        style={styles.subjectTile} 
        activeOpacity={0.7}
        onPress={() => router.push(`/subjects/${subject.id}`)}
      >
        <TouchableOpacity
          style={{ position: 'absolute', top: 14, right: 8, zIndex: 10, padding: 4 }}
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="ellipsis-vertical" size={14} color={theme.colors.text.secondary} />
        </TouchableOpacity>

        <View style={[styles.subjectBadge, { backgroundColor: subject.color || '#CCCCCC' }]}>
          <MaterialCommunityIcons name={(subject.icon as any) || 'book-outline'} size={20} color={theme.colors.text.primary} />
        </View>
        <View style={globalStyles.flex1}>
          <Text style={styles.subjectTileName} numberOfLines={1}>
            {subject.name || ((subject as any)._isPending ? t('common.pending') || 'Pendiente' : t('dashboard.newSubject.title') || 'Materia')}
          </Text>
          <Text style={styles.subjectTileMeta} numberOfLines={1}>
            {subject.professor || t('dashboard.newSubject.noProfessor')}
          </Text>
          <Text style={styles.subjectTileStats}>
            {subject.display_label ? `≈ ${subject.display_label}` : t('dashboard.subjectCardAvg', { avg: avg.toFixed(1) })}
          </Text>
          <Text style={styles.subjectTileStats}>{t('dashboard.subjectCardCompletion', { completion: completion.toFixed(0) })}</Text>
        </View>
      </TouchableOpacity>

      {menuVisible && (
        <>
          <Pressable
            style={{
              position: 'absolute',
              top: -SCREEN_H,
              left: -SCREEN_W,
              width: SCREEN_W * 3,
              height: SCREEN_H * 3,
              zIndex: 20,
            }}
            onPress={() => setMenuVisible(false)}
          />
          <View style={{
            position: 'absolute', top: 28, right: 8, zIndex: 21,
            backgroundColor: theme.colors.card,
            borderRadius: 12,
            paddingVertical: 4,
            minWidth: 130,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
          }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }}
              onPress={() => { setMenuVisible(false); onEdit?.(subject); }}
            >
              <Ionicons name="pencil-outline" size={16} color={theme.colors.text.primary} />
              <Text style={{ fontSize: 13, color: theme.colors.text.primary }}>{t('subjects.edit')}</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }}
              onPress={() => { setMenuVisible(false); onDelete?.(subject); }}
            >
              <Ionicons name="trash-outline" size={16} color="#FF2D55" />
              <Text style={{ fontSize: 13, color: '#FF2D55' }}>{t('subjects.delete')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
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
  }, [showMood, pulseAnim, pulseOpacity]);

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
