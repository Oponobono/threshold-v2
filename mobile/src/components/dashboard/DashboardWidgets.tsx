import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Pressable, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { globalStyles } from '../../styles/globalStyles';
import { theme } from '../../styles/theme';
import { AutoScrollText } from '../ui/AutoScrollText';
import { type Subject } from '../../services/api';
import { SCALE_MAX } from '../../utils/grades';
import { toVividAccent } from '../../utils/subjectThresholdHelpers';

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
  const hasGrade = avg > 0;
  const completion = typeof subject.completion_percent === 'number' ? subject.completion_percent : 0;
  const isComplete = completion >= 100;
  const avgLabel = subject.display_label ? `≈ ${subject.display_label}` : avg.toFixed(1);
  const accentColor = subject.color ? toVividAccent(subject.color) : theme.colors.primary;

  // Fondo pastel del ícono: 14% de opacidad del color del usuario (contraste garantizado)
  const iconBg = accentColor + '24';

  // Etiqueta de estado
  const statusLabel = isComplete
    ? t('dashboard.subjectCardComplete', { defaultValue: 'Completa' })
    : completion > 0
    ? t('dashboard.subjectCardInProgress', { defaultValue: 'En curso' })
    : t('dashboard.subjectCardNotStarted', { defaultValue: 'Sin iniciar' });
  const statusIcon = isComplete ? 'checkmark-circle' : completion > 0 ? 'time-outline' : 'ellipse-outline';
  const statusBg = isComplete ? '#D1FAE5' : completion > 0 ? '#FEF3C7' : '#F3F4F6';
  const statusColor = isComplete ? '#059669' : completion > 0 ? '#D97706' : '#6B7280';

  // Texto de progreso contextual: usa next_micro_milestone si existe, sino porcentaje
  const progressCtx = subject.next_micro_milestone || null;

  return (
    <View style={{ overflow: 'visible' }}>
      <TouchableOpacity
        style={[styles.subjectTile, isComplete && styles.subjectTileCompleted]}
        activeOpacity={0.75}
        accessibilityLabel={`${subject.name || 'Materia'}, ${subject.professor || ''}, ${statusLabel}, ${completion.toFixed(0)}% completado`}
        onPress={() => router.push(`/subjects/${subject.id}`)}
      >
        {/* ── CABECERA: [nombre+profesor flex] [⋮ 44×44] ── */}
        <View style={styles.subjectTileHeader}>
          <View style={styles.subjectTileNameBlock}>
            <View style={{ height: 34, width: '100%', overflow: 'hidden' }}>
              <AutoScrollText
                text={subject.name || ((subject as any)._isPending
                  ? t('common.pending') || 'Pendiente'
                  : t('dashboard.newSubject.title') || 'Materia')}
                style={styles.subjectTileName}
                direction="vertical"
                autoplay={true}
                pointerEvents="none"
                lineHeight={17}
              />
            </View>
            <View style={{ height: 16, width: '100%', overflow: 'hidden', marginTop: 2 }}>
              <AutoScrollText
                text={subject.professor || t('dashboard.newSubject.noProfessor')}
                style={[styles.subjectTileMeta, { marginTop: 0 }]}
                direction="horizontal"
                numberOfLines={1}
                autoplay={true}
                pointerEvents="none"
                lineHeight={16}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.subjectTileMenuBtn}
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={14} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* ── SEPARADOR ── */}
        <View style={styles.subjectTileDivider} />

        {/* ── CUERPO: [Promedio (izq)] [Progreso (der)] ── */}
        <View style={styles.subjectTileBody}>
          {/* Izquierda: etiqueta + badge con ícono y promedio/nota */}
          <View>
            <Text style={styles.subjectTileAvgLabel}>Promedio</Text>
            <View style={[styles.avgBadge, { backgroundColor: iconBg }]}>
              <MaterialCommunityIcons
                name={(subject.icon as any) || 'book-outline'}
                size={14}
                color={accentColor}
              />
              <Text style={[styles.avgBadgeText, { color: accentColor }]}>
                {hasGrade ? avgLabel : '—'}
              </Text>
            </View>
          </View>

          {/* Derecha: etiqueta + porcentaje de progreso (color universal) */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.subjectTileAvgLabel}>Progreso</Text>
            <View style={[styles.avgBadge, { backgroundColor: 'rgba(180,83,9,0.1)' }]}>
              <Text style={[styles.avgBadgeText, { color: '#B45309' }]}>
                {completion.toFixed(0)}%
              </Text>
            </View>
          </View>
        </View>

        {/* ── BARRA DE PROGRESO (color neutro universal) ── */}
        <View style={styles.subjectTileProgressBg}>
          <View
            style={[
              styles.subjectTileProgressFill,
              { width: `${Math.min(Math.round(completion), 100)}%` as any, backgroundColor: '#94A3B8' },
            ]}
          />
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
            position: 'absolute', top: 40, right: 8, zIndex: 21,
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
      <AutoScrollText text={value} style={styles.cardValue} lineHeight={18} />
      <AutoScrollText text={subtext} style={styles.cardSubtext} lineHeight={16} />
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
