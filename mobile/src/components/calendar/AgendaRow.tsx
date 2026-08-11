import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import { AgendaItem, CalendarScope } from '../../types/calendar';

interface AgendaRowProps {
  item: AgendaItem;
  scope: CalendarScope;
  isLast: boolean;
  onPress: (item: AgendaItem) => void;
  t: any;
}

export const AgendaRow: React.FC<AgendaRowProps> = ({ item, scope, isLast, onPress, t }) => {
  const isCompleted = item.status?.is_completed;
  
  // Decide what to show on the second line based on scope
  let contextParts: string[] = [];
  
  if (scope.kind === 'all') {
    if (item.subject) contextParts.push(item.subject);
    else if (item.title !== 'General') contextParts.push('General');
  } else {
    // If we are filtering by subject, we don't need to repeat the subject name.
    // Instead we can show other details like type, location, etc.
    let typeLabel = '';
    if (item.kind === 'class') {
      typeLabel = t('calendar.defaultClassTitle');
    } else if (item.kind === 'assessment') {
      typeLabel = item.type || t('calendar.defaultAssessmentTitle');
    } else {
      typeLabel = t('calendar.event');
    }
    
    if (typeLabel && typeLabel !== item.title) contextParts.push(typeLabel);
    if (item.location && item.location !== item.title) contextParts.push(item.location);
  }

  const contextText = contextParts.join(' • ');

  // Badge for priority or assessment type (instead of an ambiguous "!" icon)
  const isAssessment = item.kind === 'assessment';
  const badgeLabel = isAssessment ? (item.type || t('calendar.defaultAssessmentTitle')) : null;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isLast && styles.containerLast,
        isCompleted && styles.containerCompleted
      ]}
      activeOpacity={0.7}
      onPress={() => onPress(item)}
    >
      <View style={styles.timeCol}>
        <Text style={[styles.timeText, item.allDay && styles.allDayText]} numberOfLines={1}>
          {item.allDay ? t('calendar.allDay') : item.start}
        </Text>
      </View>
      
      <View style={styles.contentCol}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={1}>
            {item.title}
          </Text>
          {badgeLabel && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          )}
        </View>
        
        {contextText ? (
          <Text style={styles.contextText} numberOfLines={1}>{contextText}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingRight: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: 'transparent', // Explicitly anti-card
  },
  containerLast: {
    borderBottomWidth: 0,
  },
  containerCompleted: {
    opacity: 0.5,
  },
  timeCol: {
    width: 60,
    alignItems: 'center',
    paddingTop: 2, // slight visual alignment with title
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  allDayText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  contentCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flexShrink: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.text.secondary,
  },
  contextText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    letterSpacing: 0.5,
  }
});
