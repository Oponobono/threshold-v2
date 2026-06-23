import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { SubjectIcon } from './SubjectIcon';
import { SCALE_MAX } from '../../utils/grades';

/**
 * Darkens a hex color by a given factor (0–1).
 * factor=0.4 means 40% darker.
 */
function darkenHex(hex: string, factor: number = 0.4): string {
  const clean = hex.replace('#', '');
  const r = Math.max(0, Math.round(parseInt(clean.substring(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.round(parseInt(clean.substring(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.round(parseInt(clean.substring(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

interface SubjectRowProps {
  subject: any;
  onPress: () => void;
  onContinue?: () => void;
  onComplete?: () => void;
  isLast?: boolean;
}

export const SubjectRow = React.memo(({
  subject, onPress, onContinue, onComplete, isLast,
}: SubjectRowProps) => {
  const color = subject.color || theme.colors.primary;
  const iconColor = darkenHex(color, 0.35);

  const raw = subject.avg_score ?? 0;
  const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
  const hasGrade = avg > 0;

  const progress = subject.total_lessons && subject.total_lessons > 0
    ? (subject.completed_lessons || 0) / subject.total_lessons
    : (subject.completion_percent || 0) / 100;
  const progressPct = Math.min(Math.round(progress * 100), 100);

  // Status badge color
  const statusColor = avg === 0 ? theme.colors.text.placeholder
    : avg >= 3.0 ? theme.colors.success
    : avg >= 2.5 ? theme.colors.warning
    : theme.colors.danger;

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      style={[styles.row, isLast && styles.rowLast]}
      onPress={onPress}
    >
      {/* Left: Color avatar with icon — solid subject color bg, dark icon */}
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <SubjectIcon iconName={subject.icon} color={iconColor} size={20} />
      </View>

      {/* Center: Name + progress bar + milestone */}
      <View style={styles.center}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{subject.name}</Text>
          {subject.credits ? (
            <View style={styles.creditsBadge}>
              <Text style={styles.creditsText}>{subject.credits}cr</Text>
            </View>
          ) : null}
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: color }]} />
        </View>

        {/* Meta row: progress % + milestone */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{progressPct}% completado</Text>
          {(subject.next_milestone || subject.next_micro_milestone) && (
            <Text style={styles.milestoneText} numberOfLines={1}>
              · 🎯 {subject.next_micro_milestone || subject.next_milestone}
            </Text>
          )}
        </View>
      </View>

      {/* Right: Grade + actions + chevron */}
      <View style={styles.right}>
        {hasGrade && (
          <View style={[styles.gradeBadge, { borderColor: statusColor + '40', backgroundColor: statusColor + '10' }]}>
            <Text style={[styles.gradeText, { color: statusColor }]}>{avg.toFixed(1)}</Text>
          </View>
        )}
        <View style={styles.actions}>
          {onContinue && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: color + '15' }]}
              onPress={onContinue}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Ionicons name="play" size={12} color={color} />
            </TouchableOpacity>
          )}
          {onComplete && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.colors.success + '15' }]}
              onPress={onComplete}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <Ionicons name="checkmark-done" size={12} color={theme.colors.success} />
            </TouchableOpacity>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.colors.border} />
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  center: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flexShrink: 1,
    letterSpacing: -0.1,
  },
  creditsBadge: {
    backgroundColor: theme.colors.border,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  creditsText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.secondary,
  },
  progressTrack: {
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 10,
    color: theme.colors.text.placeholder,
    fontWeight: '500',
  },
  milestoneText: {
    fontSize: 10,
    color: theme.colors.text.placeholder,
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  gradeBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  gradeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 5,
  },
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
