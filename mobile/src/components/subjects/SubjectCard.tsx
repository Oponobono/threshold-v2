import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SubjectIcon } from './SubjectIcon';
import { SCALE_MAX } from '../../utils/grades';
import { styles } from '../../styles/SubjectCard.styles';
import { theme } from '../../styles/theme';
import { AutoScrollText } from '../ui/AutoScrollText';

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
  onPress: (subject: any) => void;
  onContinue?: (subject: any) => void;
  onComplete?: (subject: any) => void;
}

export const SubjectCard = React.memo((
  { subject, onPress, onContinue, onComplete }: SubjectCardProps,
) => {

  const color = subject.color || theme.colors.primary;
  // Fondo pastel para el icono (14% de opacidad del color del usuario)
  const iconBg = color + '24';

  const raw = subject.avg_score ?? 0;
  const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
  const hasGrade = avg > 0;

  const progress = subject.total_lessons && subject.total_lessons > 0
    ? (subject.completed_lessons || 0) / subject.total_lessons
    : (subject.completion_percent || 0) / 100;
  const progressPct = Math.min(Math.round(progress * 100), 100);
  const isComplete = progressPct >= 100;

  let statusColor = '#D97706'; // Ámbar para "En curso"
  let statusBgColor = '#FEF3C7';
  let statusBorderColor = '#FDE68A';
  let statusIconName: 'time-outline' | 'checkmark-circle' | 'ellipse-outline' = 'time-outline';
  let statusText = 'En curso';

  if (isComplete) {
    statusColor = '#059669'; // Verde para "Completa"
    statusBgColor = '#D1FAE5';
    statusBorderColor = '#A7F3D0';
    statusIconName = 'checkmark-circle';
    statusText = 'Completa';
  } else if (progressPct === 0) {
    statusColor = '#6B7280'; // Gris para "Sin iniciar"
    statusBgColor = '#F3F4F6';
    statusBorderColor = '#E5E7EB';
    statusIconName = 'ellipse-outline';
    statusText = 'Sin iniciar';
  }

  const milestoneStr = subject.next_micro_milestone || subject.next_milestone;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.card}
      onPress={() => onPress(subject)}
      accessibilityLabel={`${subject.name || 'Materia'}, estado ${statusText}, promedio ${hasGrade ? avg.toFixed(1) : 'sin calificar'}, ${progressPct}% de progreso`}
    >
      <View style={styles.headerTitleBlock}>
        <Text style={styles.title} numberOfLines={2}>
          {subject.name || 'Materia'}
        </Text>
        <Text style={styles.professorText} numberOfLines={1}>
          {subject.professor ? `Prof. ${subject.professor}` : 'Sin profesor'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.bodyContent}>
        <View style={styles.avgBadge}>
          <Text style={styles.avgBadgeText} numberOfLines={1} ellipsizeMode="tail">
            Prom. <Text style={{ color: '#111827', fontWeight: '700' }}>{hasGrade ? avg.toFixed(1) : '—'}</Text>
          </Text>
        </View>

        <View style={[styles.statusChip, { backgroundColor: statusBgColor, borderColor: statusBorderColor }]}>
          <Ionicons name={statusIconName} size={12} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
            {statusText}{milestoneStr && !isComplete ? ` · ${milestoneStr}` : ''}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Progreso</Text>
          <Text style={styles.progressPercent}>{progressPct}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%`, backgroundColor: statusColor }]} />
        </View>
      </View>

      {/* Botón de Procesar clase - Disponible en todas las materias (permite tomar apuntes siempre) */}
      {onComplete && (
        <Pressable
          style={styles.processClassBtn}
          onPress={(e) => {
            e.stopPropagation(); // Prevenir que abra la materia
            onComplete(subject);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel="Procesar clase"
        >
          <Ionicons name="sparkles" size={14} color="#4B5563" />
          <Text style={styles.processClassBtnText}>Procesar clase</Text>
        </Pressable>
      )}
    </TouchableOpacity>
  );
});
