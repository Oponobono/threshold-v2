import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { Course, Subject } from '../../services/api/types';
import { openCourseLink } from '../../utils/linking';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const HERO_CARD_WIDTH = SCREEN_WIDTH - 48; // 16px visible margin each side + 16px gap between cards

const PLATFORM_CONFIG: Record<string, { color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = {
  Platzi:   { color: '#98CA3F', icon: 'school',           label: 'Platzi' },
  Udemy:    { color: '#A435F0', icon: 'book-play',        label: 'Udemy' },
  Coursera: { color: '#0056D2', icon: 'certificate',      label: 'Coursera' },
  YouTube:  { color: '#FF0000', icon: 'youtube',          label: 'YouTube' },
  Otro:     { color: '#6B7280', icon: 'web',              label: 'Otro' },
};

interface CourseHeroCardProps {
  course: Course;
  subjects: Subject[];
  isActive: boolean;
  onPress: () => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
}

export const CourseHeroCard = React.memo(({ course, subjects, isActive, onPress, onEditPress, onDeletePress }: CourseHeroCardProps) => {
  const platform = course.platform ? PLATFORM_CONFIG[course.platform] ?? PLATFORM_CONFIG['Otro'] : null;
  const subjectCount = subjects.length;
  const totalCredits = subjects.reduce((sum, s) => sum + (s.credits ?? 0), 0);
  const completedCount = subjects.filter(s => (s.avg_score ?? 0) >= 3.0).length;
  const progressRatio = subjectCount > 0 ? completedCount / subjectCount : 0;

  const truncateUrl = (url?: string) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '…' : url;
    }
  };

  const displayUrl = truncateUrl(course.certificate_url);
  const momentumPct = Math.round((course.momentum_score ?? 0) * 100);

  const isIndependent = course.id === 'independent';

  const [menuVisible, setMenuVisible] = React.useState(false);

  return (
    <View style={{ overflow: 'visible' }}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        style={[styles.card, isActive && styles.cardActive]}
      >
        {/* Top Row: Platform badge + Momentum */}
        <View style={styles.topRow}>
          {platform && !isIndependent ? (
            <View style={[styles.platformBadge, { backgroundColor: platform.color + '18', borderColor: platform.color + '40' }]}>
              <MaterialCommunityIcons name={platform.icon} size={13} color={platform.color} />
              <Text style={[styles.platformText, { color: platform.color }]}>{platform.label}</Text>
            </View>
          ) : isIndependent ? (
            <View style={[styles.platformBadge, { backgroundColor: theme.colors.text.secondary + '18', borderColor: theme.colors.text.secondary + '40' }]}>
              <MaterialCommunityIcons name="bookshelf" size={13} color={theme.colors.text.secondary} />
              <Text style={[styles.platformText, { color: theme.colors.text.secondary }]}>Sin Asignar</Text>
            </View>
          ) : <View />}

          {!isIndependent && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.momentumBadge}>
                <Ionicons name="flame" size={12} color="#FF9500" />
                <Text style={styles.momentumText}>{momentumPct}%</Text>
              </View>
              {onEditPress || onDeletePress ? (
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 4 }}>
                  <Ionicons name="ellipsis-vertical" size={16} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

      {course.instructor ? (
        <View style={styles.instructorRow}>
          <Ionicons name="person-outline" size={12} color={theme.colors.text.placeholder} />
          <Text style={styles.instructorText} numberOfLines={1}>{course.instructor}</Text>
        </View>
      ) : null}

      {/* Course Name */}
      <Text style={styles.courseName} numberOfLines={2}>{course.name}</Text>

      {/* Tags */}
      {course.tags ? (
        <View style={styles.tagsRow}>
          {course.tags.split(',').map((tag, i) => (
            <View key={i} style={styles.tagBadge}>
              <Text style={styles.tagText}>{tag.trim()}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* main_url external link */}
      {course.main_url && (
        <TouchableOpacity
          style={styles.mainUrlRow}
          onPress={() => openCourseLink(course.main_url!)}
        >
          <Ionicons name="open-outline" size={12} color={theme.colors.primary} />
          <Text style={styles.mainUrlText} numberOfLines={1}>Ir al curso original</Text>
        </TouchableOpacity>
      )}

      {/* URL hint */}
      {displayUrl && (
        <View style={styles.urlRow}>
          <Ionicons name="link-outline" size={12} color={theme.colors.text.placeholder} />
          <Text style={styles.urlText} numberOfLines={1}>{displayUrl}</Text>
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{subjectCount}</Text>
          <Text style={styles.statLabel}>{subjectCount === 1 ? 'Materia' : 'Materias'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalCredits > 0 ? totalCredits : '—'}</Text>
          <Text style={styles.statLabel}>Créditos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Aprobadas</Text>
        </View>
      </View>

        {/* Progress bar */}
        {subjectCount > 0 && (
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.round(progressRatio * 100)}%` as any }]} />
          </View>
        )}
      </TouchableOpacity>

      {menuVisible && (
        <>
          <Pressable
            style={{
              position: 'absolute',
              top: -1000,
              left: -1000,
              width: 3000,
              height: 3000,
              zIndex: 20,
            }}
            onPress={() => setMenuVisible(false)}
          />
          <View style={{
            position: 'absolute', top: 50, right: 20, zIndex: 21,
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
            {onEditPress && (
              <>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }}
                  onPress={() => { setMenuVisible(false); onEditPress(); }}
                >
                  <Ionicons name="pencil-outline" size={16} color={theme.colors.text.primary} />
                  <Text style={{ fontSize: 13, color: theme.colors.text.primary }}>Editar</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />
              </>
            )}
            {onDeletePress && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 }}
                onPress={() => { setMenuVisible(false); onDeletePress(); }}
              >
                <Ionicons name="trash-outline" size={16} color="#FF2D55" />
                <Text style={{ fontSize: 13, color: '#FF2D55' }}>Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
});

/** Tarjeta especial "Ver todas las materias" con diseño Premium Global */
export const AllSubjectsHeroCard = React.memo(({ subjects, isActive, onPress }: { subjects: Subject[]; isActive: boolean; onPress: () => void }) => {
  const subjectCount = subjects.length;
  const totalCredits = subjects.reduce((sum, s) => sum + (s.credits ?? 0), 0);
  const completedCount = subjects.filter(s => (s.avg_score ?? 0) >= 3.0).length;
  const progressRatio = subjectCount > 0 ? completedCount / subjectCount : 0;

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[styles.card, styles.cardAllGlobal, isActive && styles.cardActiveGlobal]}>
      <View style={styles.topRow}>
        <View style={[styles.platformBadge, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30', borderWidth: 1 }]}>
          <Ionicons name="globe-outline" size={13} color={theme.colors.primary} />
          <Text style={[styles.platformText, { color: theme.colors.primary }]}>Vista Global</Text>
        </View>
      </View>

      <Text style={[styles.courseName, { color: theme.colors.text.primary }]} numberOfLines={2}>Todas tus materias</Text>
      
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>{subjectCount}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.placeholder }]}>{subjectCount === 1 ? 'Materia' : 'Materias'}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>{totalCredits > 0 ? totalCredits : '—'}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.placeholder }]}>Créditos</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>{completedCount}</Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.placeholder }]}>Aprobadas</Text>
        </View>
      </View>

      {subjectCount > 0 && (
        <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border }]}>
          <View style={[styles.progressBarFill, { width: `${Math.round(progressRatio * 100)}%` as any, backgroundColor: theme.colors.success }]} />
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    width: HERO_CARD_WIDTH,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FAFBFF',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  platformText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  momentumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 149, 0, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  momentumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9500',
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  instructorText: {
    fontSize: 12,
    color: theme.colors.text.placeholder,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: theme.colors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  mainUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  mainUrlText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  courseName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 6,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  urlText: {
    fontSize: 11,
    color: theme.colors.text.placeholder,
    fontWeight: '500',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
    opacity: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.text.placeholder,
    fontWeight: '500',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 4,
  },
  // "All subjects" card variant (Global Dashboard)
  cardAllGlobal: {
    backgroundColor: theme.colors.card,
    borderColor: 'transparent',
  },
  cardActiveGlobal: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FAFBFF',
  },
});
