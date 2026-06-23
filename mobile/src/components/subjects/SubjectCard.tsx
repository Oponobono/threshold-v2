import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { SubjectIcon } from './SubjectIcon';
import { SCALE_MAX } from '../../utils/grades';

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

  // Grade calculation
  const raw = subject.avg_score ?? 0;
  const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
  const hasGrade = avg > 0;
  
  let statusColor = '#999999';
  let statusBgColor = '#F2F2F2';
  
  if (hasGrade) {
    if (avg >= 3.0) {
      statusColor = '#059669'; // Emerald 600
      statusBgColor = '#D1FAE5'; // Emerald 100
    } else if (avg >= 2.5) {
      statusColor = '#D97706'; // Amber 600
      statusBgColor = '#FEF3C7'; // Amber 100
    } else {
      statusColor = '#DC2626'; // Red 600
      statusBgColor = '#FEE2E2'; // Red 100
    }
  }

  // Progress calculation
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
        {/* Header: Icon & Badge */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: color }]}>
            <SubjectIcon iconName={subject.icon} color={darkenHex(color, 0.45)} size={20} />
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

        {/* Title & Details */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {subject.name}
          </Text>
          
          {(subject.next_micro_milestone || subject.next_milestone) && (
            <View style={styles.milestoneContainer}>
              <Ionicons name="flag-outline" size={12} color="#6B7280" />
              <Text style={styles.milestoneText} numberOfLines={1}>
                {subject.next_micro_milestone || subject.next_milestone}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />

        {/* Progress & Actions */}
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

          {/* Actions */}
          {(onContinue || onComplete) && (
            <View style={styles.actionsRow}>
              {onContinue && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: color }]}
                  onPress={onContinue}
                >
                  <Ionicons name="play" size={12} color="#FFFFFF" />
                  <Text style={styles.btnPrimaryText}>Continuar</Text>
                </TouchableOpacity>
              )}
              {onComplete && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary, !onContinue && { flex: 1 }]}
                  onPress={onComplete}
                >
                  <Ionicons name="sparkles" size={14} color="#059669" />
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

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    minHeight: 190,
    // Soft, diffuse drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6', // Very subtle border to define edge
  },
  content: {
    flex: 1,
    padding: 16,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  infoContainer: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827', // Gray 900
    lineHeight: 20,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  milestoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  milestoneText: {
    fontSize: 12,
    color: '#6B7280', // Gray 500
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    marginTop: 'auto',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF', // Gray 400
    letterSpacing: 0.5,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151', // Gray 700
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F3F4F6', // Gray 100
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  btnPrimary: {
    flex: 1,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: '#F0FDF4', // Green 50
    borderWidth: 1,
    borderColor: '#DCFCE7', // Green 100
  },
  btnSecondaryText: {
    color: '#059669', // Emerald 600
    fontSize: 12,
    fontWeight: '700',
  },
});
