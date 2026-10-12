import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { SubjectIcon } from './SubjectIcon';
import { SCALE_MAX } from '../../utils/grades';
import { formatSubjectTitle } from '../../utils/textFormat';
import { styles } from '../../styles/SubjectRow.styles';


interface SubjectRowProps {
  subject: any;
  onPress: () => void;
  onContinue?: () => void;
  onComplete?: () => void;
  isLast?: boolean;
  courseName?: string;
  isBranch?: boolean;
  isFirst?: boolean;
}

export const SubjectRow = React.memo(({
  subject, onPress, onContinue, onComplete, isLast, courseName, isBranch, isFirst,
}: SubjectRowProps) => {
  const color = subject.color || theme.colors.primary;

  const raw = subject.avg_score ?? 0;
  const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
  const hasGrade = avg > 0;

  const progress = subject.total_lessons && subject.total_lessons > 0
    ? (subject.completed_lessons || 0) / subject.total_lessons
    : (subject.completion_percent || 0) / 100;
  const progressPct = Math.min(Math.round(progress * 100), 100);

  const statusLabel = progressPct >= 100 ? 'completada' : progressPct > 0 ? 'en curso' : 'sin iniciar';
  const gradeLabel = hasGrade ? `, promedio ${avg.toFixed(1)}` : '';
  const accessibilityLabel = `${subject.name}, ${statusLabel}${gradeLabel}`;

  return (
    <TouchableOpacity
      activeOpacity={0.65}
      style={[
        styles.row,
        isLast && styles.rowLast,
        !isBranch && { paddingLeft: 14 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Guía de jerarquía tipo viñeta / árbol conectada al curso */}
      {isBranch && (
        <View style={styles.treeGuideCol}>
          {/* Línea vertical superior */}
          <View style={styles.treeLineVerticalTop} />
          {/* Línea vertical inferior continúa si no es el último */}
          {!isLast && <View style={styles.treeLineVerticalBottom} />}
          {/* Ramificación horizontal hacia la materia */}
          <View style={styles.treeLineHorizontal} />
          {/* Nodo / viñeta conectora */}
          <View style={styles.treeDot} />
        </View>
      )}

      {/* Left: Pastel avatar (25% más pequeño: 30x30 con icono size 15) */}
      <View style={[styles.avatar, { backgroundColor: color + '20' }]}>
        <SubjectIcon iconName={subject.icon} color={color} size={15} />
      </View>

      {/* Center: Name + course label + meta row */}
      <View style={styles.center}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{formatSubjectTitle(subject.name)}</Text>
        </View>

        {courseName ? (
          <Text style={styles.courseSubtitle} numberOfLines={1}>
            {courseName}
          </Text>
        ) : null}

        {/* Fila 2 (Meta): [En curso si < 100%] + [XX%] + [Xcr] + [Hito] */}
        <View style={styles.metaRow}>
          {progressPct < 100 && (
            <View style={styles.activeStatusBadge}>
              <Text style={styles.activeStatusBadgeText}>En curso</Text>
            </View>
          )}

          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>{progressPct}%</Text>
          </View>

          {subject.credits ? (
            <View style={styles.creditsBadge}>
              <Text style={styles.creditsText}>{subject.credits}cr</Text>
            </View>
          ) : null}

          {(subject.next_milestone || subject.next_micro_milestone) && (
            <Text style={styles.milestoneText} numberOfLines={1}>
              🎯 {subject.next_micro_milestone || subject.next_milestone}
            </Text>
          )}
        </View>
      </View>

      {/* Right: [Promedio] -> [Botón Procesar clase] -> [Continuar (si existe)] -> [>] */}
      <View style={styles.right}>
        {hasGrade && (
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeText}>{avg.toFixed(1)}</Text>
          </View>
        )}

        {onComplete && (
          <TouchableOpacity
            style={styles.processBtn}
            onPress={onComplete}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Procesar clase de ${subject.name}`}
          >
            <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {onContinue && (
          <TouchableOpacity
            style={[styles.actionPlayBtn, { backgroundColor: color + '15' }]}
            onPress={onContinue}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`Continuar ${subject.name}`}
          >
            <Ionicons name="play" size={13} color={color} />
          </TouchableOpacity>
        )}

        <Ionicons name="chevron-forward" size={15} color={theme.colors.text.secondary} />
      </View>
    </TouchableOpacity>
  );
});
