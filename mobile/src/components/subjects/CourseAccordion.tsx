import React from 'react';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { openCourseLink } from '../../utils/linking';
import { styles } from '../../styles/CourseAccordion.styles';

interface CourseAccordionProps {
  courseId: string;
  courseName: string;
  platform?: string;
  mainUrl?: string;
  isCollapsed: boolean;
  onToggle: (id: string) => void;
}

export const CourseAccordion = React.memo(({ courseId, courseName, platform, mainUrl, isCollapsed, onToggle }: CourseAccordionProps) => {
  return (
    <View style={styles.wrapper}>
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

        <View style={styles.headerRight}>
          {mainUrl ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => openCourseLink(mainUrl, platform)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          ) : null}
          <Ionicons 
            name="chevron-down" 
            size={20} 
            color={theme.colors.text.secondary} 
            style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }}
          />
        </View>
      </Pressable>
    </View>
  );
});
