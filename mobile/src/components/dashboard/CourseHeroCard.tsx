import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { cHCardStyles, HERO_CARD_WIDTH } from '../../styles/CourseHeroCard.styles';
export { HERO_CARD_WIDTH };
import { Course, Subject } from '../../services/api/types';
import { openCourseLink } from '../../utils/linking';

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
        style={[cHCardStyles.card, isActive && cHCardStyles.cardActive]}
      >
        {/* Top Row: Platform badge + Momentum */}
        <View style={cHCardStyles.topRow}>
          {platform && !isIndependent ? (
            <View style={[cHCardStyles.platformBadge, { backgroundColor: platform.color + '18', borderColor: platform.color + '40' }]}>
              <MaterialCommunityIcons name={platform.icon} size={13} color={platform.color} />
              <Text style={[cHCardStyles.platformText, { color: platform.color }]}>{platform.label}</Text>
            </View>
          ) : isIndependent ? (
            <View style={[cHCardStyles.platformBadge, { backgroundColor: theme.colors.text.secondary + '18', borderColor: theme.colors.text.secondary + '40' }]}>
              <MaterialCommunityIcons name="bookshelf" size={13} color={theme.colors.text.secondary} />
              <Text style={[cHCardStyles.platformText, { color: theme.colors.text.secondary }]}>Sin Asignar</Text>
            </View>
          ) : <View />}

          {!isIndependent && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={cHCardStyles.momentumBadge}>
                <Ionicons name="flame" size={12} color="#FF9500" />
                <Text style={cHCardStyles.momentumText}>{momentumPct}%</Text>
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
        <View style={cHCardStyles.instructorRow}>
          <Ionicons name="person-outline" size={12} color={theme.colors.text.placeholder} />
          <Text style={cHCardStyles.instructorText} numberOfLines={1}>{course.instructor}</Text>
        </View>
      ) : null}

      {/* Course Name */}
      <Text style={cHCardStyles.courseName} numberOfLines={2}>{course.name}</Text>

      {/* Tags */}
      {course.tags ? (
        <View style={cHCardStyles.tagsRow}>
          {course.tags.split(',').map((tag, i) => (
            <View key={i} style={cHCardStyles.tagBadge}>
              <Text style={cHCardStyles.tagText}>{tag.trim()}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* main_url external link */}
      {course.main_url && (
        <TouchableOpacity
          style={cHCardStyles.mainUrlRow}
          onPress={() => openCourseLink(course.main_url!, course.platform ?? undefined)}
        >
          <Ionicons name="open-outline" size={12} color={theme.colors.primary} />
          <Text style={cHCardStyles.mainUrlText} numberOfLines={1}>Ir al curso original</Text>
        </TouchableOpacity>
      )}

      {/* URL hint */}
      {displayUrl && (
        <View style={cHCardStyles.urlRow}>
          <Ionicons name="link-outline" size={12} color={theme.colors.text.placeholder} />
          <Text style={cHCardStyles.urlText} numberOfLines={1}>{displayUrl}</Text>
        </View>
      )}

      {/* Divider */}
      <View style={cHCardStyles.divider} />

      {/* Stats Row */}
      <View style={cHCardStyles.statsRow}>
        <View style={cHCardStyles.stat}>
          <Text style={cHCardStyles.statValue}>{subjectCount}</Text>
          <Text style={cHCardStyles.statLabel}>{subjectCount === 1 ? 'Materia' : 'Materias'}</Text>
        </View>
        <View style={cHCardStyles.statDivider} />
        <View style={cHCardStyles.stat}>
          <Text style={cHCardStyles.statValue}>{totalCredits > 0 ? totalCredits : '—'}</Text>
          <Text style={cHCardStyles.statLabel}>Créditos</Text>
        </View>
        <View style={cHCardStyles.statDivider} />
        <View style={cHCardStyles.stat}>
          <Text style={[cHCardStyles.statValue, { color: theme.colors.success }]}>{completedCount}</Text>
          <Text style={cHCardStyles.statLabel}>Aprobadas</Text>
        </View>
      </View>

        {/* Progress bar */}
        {subjectCount > 0 && (
          <View style={cHCardStyles.progressBarBg}>
            <View style={[cHCardStyles.progressBarFill, { width: `${Math.round(progressRatio * 100)}%` as any }]} />
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

interface AllSubjectsHeroCardProps {
  subjects: Subject[];
  courses: Course[];
  nextAssessment?: { name: string; date?: string } | null;
  isActive: boolean;
  onPress: () => void;
}

export const AllSubjectsHeroCard = React.memo(({ subjects, courses, nextAssessment, isActive, onPress }: AllSubjectsHeroCardProps) => {
  const subjectCount = subjects.length;
  const totalCredits = subjects.reduce((sum, s) => sum + (s.credits ?? 0), 0);

  // Promedio global de todas las materias con nota
  const subjectsWithGrade = subjects.filter(s => (s.avg_score ?? 0) > 0);
  const globalAvg = subjectsWithGrade.length > 0
    ? subjectsWithGrade.reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / subjectsWithGrade.length
    : null;

  // Materias en riesgo (nota < 3.0)
  const atRiskCount = subjects.filter(s => (s.avg_score ?? 0) > 0 && (s.avg_score ?? 0) < 3.0).length;

  // Distribución por cursos (solo los primeros 3)
  const courseBreakdown = courses.slice(0, 3).map(c => ({
    id: c.id,
    name: c.name.length > 12 ? c.name.substring(0, 12) + '…' : c.name,
    count: subjects.filter(s => s.course_id === c.id).length,
    color: c.platform ? (PLATFORM_CONFIG[c.platform]?.color ?? theme.colors.primary) : theme.colors.primary,
  })).filter(c => c.count > 0);
  const independentCount = subjects.filter(s => !s.course_id).length;

  // Próxima entrega
  const examDays = nextAssessment?.date ? (() => {
    try {
      const [d, m, y] = nextAssessment.date.split('-').map(Number);
      const due = new Date(y, m - 1, d);
      return Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    } catch { return null; }
  })() : null;
  const examColor = examDays === null ? theme.colors.text.placeholder
    : examDays <= 1 ? '#D32F2F'
    : examDays <= 3 ? '#F57C00'
    : examDays <= 7 ? '#F9A825'
    : '#388E3C';

  const avgColor = globalAvg === null ? theme.colors.text.placeholder
    : globalAvg >= 4.0 ? '#388E3C'
    : globalAvg >= 3.0 ? '#F9A825'
    : '#D32F2F';

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={[cHCardStyles.card, cHCardStyles.cardAllGlobal, isActive && cHCardStyles.cardActiveGlobal]}>
      {/* Top Row: badge + global avg */}
      <View style={cHCardStyles.topRow}>
        <View style={[cHCardStyles.platformBadge, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30', borderWidth: 1 }]}>
          <Ionicons name="globe-outline" size={13} color={theme.colors.primary} />
          <Text style={[cHCardStyles.platformText, { color: theme.colors.primary }]}>Vista Global</Text>
        </View>
        {globalAvg !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: avgColor + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 }}>
            <Ionicons name="trophy-outline" size={11} color={avgColor} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: avgColor }}>{globalAvg.toFixed(2)}</Text>
          </View>
        )}
      </View>

      <Text style={[cHCardStyles.courseName, { color: theme.colors.text.primary }]} numberOfLines={1}>Todas tus materias</Text>

      {/* Course distribution pills */}
      {courseBreakdown.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {courseBreakdown.map(c => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: c.color + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 }}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.color }} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: c.color }}>{c.name}</Text>
              <Text style={{ fontSize: 10, color: c.color, opacity: 0.7 }}>{c.count}</Text>
            </View>
          ))}
          {independentCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.text.secondary + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 }}>
              <Ionicons name="bookmark-outline" size={9} color={theme.colors.text.secondary} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.text.secondary }}>Indep. {independentCount}</Text>
            </View>
          )}
        </View>
      )}

      <View style={[cHCardStyles.divider, { backgroundColor: theme.colors.border }]} />

      {/* Stats row */}
      <View style={cHCardStyles.statsRow}>
        <View style={cHCardStyles.stat}>
          <Text style={[cHCardStyles.statValue, { color: theme.colors.text.primary }]}>{subjectCount}</Text>
          <Text style={[cHCardStyles.statLabel, { color: theme.colors.text.placeholder }]}>{subjectCount === 1 ? 'Materia' : 'Materias'}</Text>
        </View>
        <View style={[cHCardStyles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={cHCardStyles.stat}>
          <Text style={[cHCardStyles.statValue, { color: theme.colors.text.primary }]}>{totalCredits > 0 ? totalCredits : '—'}</Text>
          <Text style={[cHCardStyles.statLabel, { color: theme.colors.text.placeholder }]}>Créditos</Text>
        </View>
        <View style={[cHCardStyles.statDivider, { backgroundColor: theme.colors.border }]} />
        <View style={cHCardStyles.stat}>
          <Text style={[cHCardStyles.statValue, { color: atRiskCount > 0 ? '#D32F2F' : theme.colors.text.placeholder }]}>
            {atRiskCount > 0 ? atRiskCount : '—'}
          </Text>
          <Text style={[cHCardStyles.statLabel, { color: atRiskCount > 0 ? '#D32F2F' : theme.colors.text.placeholder }]}>En riesgo</Text>
        </View>
      </View>

      {/* Next assessment */}
      {nextAssessment && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: examColor + '10', borderRadius: 8, marginTop: 2 }}>
          <Ionicons name="alarm-outline" size={12} color={examColor} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: examColor, flex: 1 }} numberOfLines={1}>
            {nextAssessment.name}
          </Text>
          <Text style={{ fontSize: 10, color: examColor, fontWeight: '700' }}>
            {examDays === 0 ? '¡Hoy!' : examDays === 1 ? 'Mañana' : `${examDays}d`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});
