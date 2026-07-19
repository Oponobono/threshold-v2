import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubjectIcon } from './SubjectIcon';
import { SCALE_MAX } from '../../utils/grades';
import { styles } from '../../styles/SubjectCard.styles';
import { theme } from '../../styles/theme';

function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function darkenHex(hex: string, factor: number = 0.5): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex || '#000000';
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
  if (clean.length !== 6) return hex;

  const r = Math.max(0, Math.round(parseInt(clean.substring(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(clean.substring(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(clean.substring(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface SubjectCardProps {
  subject: any;
  onPress: () => void;
  onContinue?: () => void;
  onComplete?: () => void;
}

export const SubjectCard = React.memo(({
  subject, onPress, onContinue, onComplete,
}: SubjectCardProps) => {
  const color = subject.color || theme.colors.primary;

  const raw = subject.avg_score ?? 0;
  const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
  const hasGrade = avg > 0;

  let statusColor = '#999999';
  let statusBgColor = '#F2F2F2';

  if (hasGrade) {
    if (avg >= 3.0) {
      statusColor = '#059669';
      statusBgColor = '#D1FAE5';
    } else if (avg >= 2.5) {
      statusColor = '#D97706';
      statusBgColor = '#FEF3C7';
    } else {
      statusColor = '#DC2626';
      statusBgColor = '#FEE2E2';
    }
  }

  const progress = subject.total_lessons && subject.total_lessons > 0
    ? (subject.completed_lessons || 0) / subject.total_lessons
    : (subject.completion_percent || 0) / 100;
  const progressPct = Math.min(Math.round(progress * 100), 100);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.card}
      onPress={onPress}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <SubjectIcon iconName={subject.icon} color={darkenHex(color, 0.45)} size={17} />
          </View>

          {hasGrade ? (
            <View style={[styles.badge, { backgroundColor: statusBgColor }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{avg.toFixed(1)}</Text>
            </View>
          ) : subject.credits ? (
            <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.badgeText, { color: '#4B5563' }]}>{subject.credits} cr</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {subject.name}
          </Text>

          {(subject.next_micro_milestone || subject.next_milestone) && (
            <View style={styles.milestoneContainer}>
              <Ionicons name="flag-outline" size={10} color="#6B7280" />
              <Text style={styles.milestoneText} numberOfLines={1}>
                {subject.next_micro_milestone || subject.next_milestone}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.footer}>
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>PROGRESO</Text>
              <Text style={styles.progressPercent}>{progressPct}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: color }]} />
            </View>
          </View>

          {(onContinue || onComplete) && (
            <View style={styles.actionsRow}>
              {onContinue && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: color }]}
                  onPress={onContinue}
                >
                  <Ionicons name="play" size={10} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>Continuar</Text>
                </TouchableOpacity>
              )}
              {onComplete && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, !onContinue && { flex: 1 }]}
                  onPress={onComplete}
                >
                  <Ionicons name="sparkles" size={12} color="#059669" />
                  <Text style={styles.btnSecondaryText}>Procesar clase</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});
