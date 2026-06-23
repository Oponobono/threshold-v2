import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

interface CourseAccordionProps {
  courseId: string;
  courseName: string;
  platform?: string;
  isCollapsed: boolean;
  onToggle: (id: string) => void;
}

export const CourseAccordion = React.memo(({ courseId, courseName, platform, isCollapsed, onToggle }: CourseAccordionProps) => {
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.7 }
      ]}
      onPress={() => onToggle(courseId)}
    >
      <View style={styles.headerLeft}>
        <Ionicons name="school" size={16} color={theme.colors.primary} style={styles.icon} />
        <Text style={styles.title} numberOfLines={1}>{courseName.toUpperCase()}</Text>
        {platform && (
          <View style={styles.platformBadge}>
            <Text style={styles.platformText}>{platform}</Text>
          </View>
        )}
      </View>

      <Ionicons 
        name="chevron-down" 
        size={20} 
        color={theme.colors.text.secondary} 
        style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    marginTop: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 16,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 8,
    flexShrink: 1,
  },
  platformBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  platformText: {
    color: theme.colors.text.secondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  }
});
