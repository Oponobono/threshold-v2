import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { SubjectIcon } from './SubjectIcon';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PLATFORM_META: Record<string, { color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  Platzi:   { color: '#98CA3F', icon: 'school-outline' },
  Udemy:    { color: '#A435F0', icon: 'book-play-outline' },
  Coursera: { color: '#0056D2', icon: 'certificate-outline' },
  YouTube:  { color: '#FF0000', icon: 'youtube' },
  Otro:     { color: '#8E8E93', icon: 'web' },
};

interface CourseGroupCardProps {
  courseId: string;
  courseName: string;
  platform?: string;
  subjects: any[];
  isCollapsed: boolean;
  onToggle: (id: string) => void;
  onSubjectPress: (id: string) => void;
  onSubjectContinue?: (url: string) => void;
  onSubjectComplete?: (subject: any, courseName: string) => void;
}

export const CourseGroupCard = React.memo(({
  courseId, courseName, platform, subjects, isCollapsed,
  onToggle, onSubjectPress, onSubjectContinue, onSubjectComplete,
}: CourseGroupCardProps) => {

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle(courseId);
  };

  const isIndependent = courseId === 'independent';
  const meta = platform && !isIndependent ? (PLATFORM_META[platform] || PLATFORM_META['Otro']) : null;
  const accentColor = meta?.color ?? (isIndependent ? '#8E8E93' : theme.colors.primary);

  return (
    <View style={styles.wrapper}>
      {/* ── Section header (sticky-style pill) ── */}
      <TouchableOpacity activeOpacity={0.7} style={styles.sectionHeader} onPress={handleToggle}>
        <View style={styles.sectionLeft}>
          {meta ? (
            <MaterialCommunityIcons name={meta.icon} size={14} color={accentColor} style={{ marginRight: 6 }} />
          ) : (
            <Ionicons name={isIndependent ? 'layers-outline' : 'school-outline'} size={14} color={accentColor} style={{ marginRight: 6 }} />
          )}
          <Text style={[styles.sectionTitle, { color: accentColor }]}>
            {courseName.toUpperCase()}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: accentColor + '18' }]}>
            <Text style={[styles.countText, { color: accentColor }]}>{subjects.length}</Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={theme.colors.text.placeholder}
          style={{ transform: [{ rotate: isCollapsed ? '0deg' : '90deg' }] }}
        />
      </TouchableOpacity>

      {/* ── Subject rows ── */}
      {!isCollapsed && (
        <View style={styles.listContainer}>
          {subjects.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="add-circle-outline" size={16} color={theme.colors.text.placeholder} />
              <Text style={styles.emptyText}>Sin materias aún</Text>
            </View>
          ) : (
            subjects.map((subject, index) => {
              const color = subject.color || theme.colors.primary;
              const isLast = index === subjects.length - 1;
              const progress = subject.total_lessons && subject.total_lessons > 0
                ? (subject.completed_lessons || 0) / subject.total_lessons
                : (subject.completion_percent || 0) / 100;
              const progressPct = Math.min(Math.round(progress * 100), 100);

              return (
                <TouchableOpacity
                  key={subject.id}
                  activeOpacity={0.65}
                  style={[styles.row, isLast && styles.rowLast]}
                  onPress={() => onSubjectPress(subject.id)}
                >
                  {/* Color dot */}
                  <View style={[styles.dot, { backgroundColor: color }]} />

                  {/* Icon */}
                  <View style={[styles.iconWrap, { backgroundColor: color + '15' }]}>
                    <SubjectIcon iconName={subject.icon} color={color} size={14} />
                  </View>

                  {/* Name + progress bar */}
                  <View style={styles.rowMain}>
                    <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                    <View style={styles.progressRow}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.progressText}>{progressPct}%</Text>
                    </View>
                  </View>

                  {/* Right actions */}
                  <View style={styles.rowActions}>
                    {subject.external_url && onSubjectContinue && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: color + '15' }]}
                        onPress={() => onSubjectContinue!(subject.external_url)}
                        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                      >
                        <Ionicons name="play" size={12} color={color} />
                      </TouchableOpacity>
                    )}
                    {onSubjectComplete && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.colors.success + '15' }]}
                        onPress={() => onSubjectComplete!(subject, courseName)}
                        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                      >
                        <Ionicons name="checkmark-done" size={12} color={theme.colors.success} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.border} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 20,
  },

  // Section header pill
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginRight: 8,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // List container (inset group)
  listContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Empty
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.text.placeholder,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowMain: {
    flex: 1,
    gap: 5,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
    letterSpacing: -0.1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.text.placeholder,
    width: 26,
    textAlign: 'right',
  },

  // Row actions
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
