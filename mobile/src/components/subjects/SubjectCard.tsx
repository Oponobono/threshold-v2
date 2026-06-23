import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { SubjectIcon } from './SubjectIcon';
import { SCALE_MAX } from '../../utils/grades';

/** Darkens a hex color by factor (0–1). Same logic as SubjectRow. */
function darkenHex(hex: string, factor: number = 0.4): string {
  const clean = hex.replace('#', '');
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
  // ── Colores: fondo sólido + ícono oscurecido ──
  const color = subject.color || theme.colors.primary;
  const iconColor = darkenHex(color, 0.35);

  // ── Nota ──
  const raw = subject.avg_score ?? 0;
  const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
  const hasGrade = avg > 0;
  const statusColor = !hasGrade
    ? '#999999'
    : avg >= 3.0
    ? theme.colors.success
    : avg >= 2.5
    ? theme.colors.warning
    : theme.colors.danger;

  // ── Progreso ──
  const progress = subject.total_lessons && subject.total_lessons > 0
    ? (subject.completed_lessons || 0) / subject.total_lessons
    : (subject.completion_percent || 0) / 100;
  const progressPct = Math.min(Math.round(progress * 100), 100);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={onPress}
    >
      {/* ── Franja de color superior ── */}
      <View style={[styles.colorStripe, { backgroundColor: color }]} />

      {/* ── Contenido ── */}
      <View style={styles.body}>

        {/* Fila superior: avatar + badge */}
        <View style={styles.topRow}>
          {/* Avatar: fondo sólido + ícono oscurecido */}
          <View style={[styles.avatar, { backgroundColor: color }]}>
            <SubjectIcon iconName={subject.icon} color={iconColor} size={18} />
          </View>

          {/* Badge: nota si existe, créditos si no */}
          {hasGrade ? (
            <View style={[styles.badge, { backgroundColor: statusColor + '20', borderColor: statusColor + '60' }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{avg.toFixed(1)}</Text>
            </View>
          ) : subject.credits ? (
            <View style={[styles.badge, { backgroundColor: '#00000010', borderColor: '#00000020' }]}>
              <Text style={[styles.badgeText, { color: '#666' }]}>{subject.credits}cr</Text>
            </View>
          ) : null}
        </View>

        {/* Nombre de la materia */}
        <Text style={styles.name} numberOfLines={2}>{subject.name}</Text>

        {/* Milestone */}
        {(subject.next_micro_milestone || subject.next_milestone) ? (
          <View style={styles.milestoneRow}>
            <Text style={styles.milestoneIcon}>🎯</Text>
            <Text style={styles.milestoneText} numberOfLines={2}>
              {subject.next_micro_milestone || subject.next_milestone}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }} />

        {/* Barra de progreso */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progreso</Text>
            <Text style={[styles.progressPct, { color }]}>{progressPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: color }]} />
          </View>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionsRow}>
          {onContinue && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: color, flex: 1 }]}
              onPress={onContinue}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Ionicons name="play" size={10} color="#fff" />
              <Text style={styles.actionLabelWhite}>Continuar</Text>
            </TouchableOpacity>
          )}
          {onComplete && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: '#00000008', borderWidth: 1, borderColor: '#00000015' },
                !onContinue && { flex: 1 },
              ]}
              onPress={onComplete}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Ionicons name="checkmark-done" size={10} color={theme.colors.success} />
              <Text style={[styles.actionLabel, { color: theme.colors.success }]}>
                {onContinue ? '' : 'Clase lista'}
              </Text>
            </TouchableOpacity>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
    minHeight: 180,
    // Sombra ligera
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  // Franja de acento de color en la parte superior
  colorStripe: {
    height: 4,
    width: '100%',
  },
  body: {
    flex: 1,
    padding: 11,
    gap: 8,
    flexDirection: 'column',  // asegura que el spacer flex:1 empuje contenido al fondo
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Fondo sólido + ícono oscurecido (idéntico a SubjectRow)
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 3,
  },
  milestoneIcon: {
    fontSize: 9,
    marginTop: 1,
  },
  milestoneText: {
    fontSize: 10,
    color: '#888888',
    flex: 1,
    lineHeight: 13,
  },
  progressSection: {
    gap: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#AAAAAA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressPct: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#EEEEEE',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionLabelWhite: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
});
