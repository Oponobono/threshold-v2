import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { styles } from '../../styles/CoursePills.styles';

interface Course {
  id: string;
  name: string;
  platform?: string;
}

interface CoursePillsProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelectCourse: (id: string | null) => void;
}

const PLATFORM_ICON: Record<string, string> = {
  platzi: 'lightning-bolt',
  udemy: 'school-outline',
  coursera: 'certificate-outline',
  youtube: 'youtube',
};

export const CoursePills: React.FC<CoursePillsProps> = ({
  courses,
  selectedCourseId,
  onSelectCourse,
}) => {
  if (courses.length === 0) return null;

  const getIcon = (platform?: string) => {
    if (!platform) return null;
    return PLATFORM_ICON[platform.toLowerCase()] || null;
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {/* Pill "Todos los cursos" */}
      <TouchableOpacity
        style={[styles.pill, selectedCourseId === null && styles.pillActive]}
        onPress={() => onSelectCourse(null)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="layers-outline"
          size={13}
          color={selectedCourseId === null ? '#fff' : theme.colors.text.secondary}
          style={{ marginRight: 4 }}
        />
        <Text style={[styles.pillText, selectedCourseId === null && styles.pillTextActive]}>
          Todos
        </Text>
      </TouchableOpacity>

      {courses.map((course) => {
        const isActive = selectedCourseId === course.id;
        const icon = getIcon(course.platform);
        return (
          <TouchableOpacity
            key={course.id}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelectCourse(isActive ? null : course.id)}
            activeOpacity={0.7}
          >
            {icon && (
              <MaterialCommunityIcons
                name={icon as any}
                size={13}
                color={isActive ? '#fff' : theme.colors.text.secondary}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              style={[styles.pillText, isActive && styles.pillTextActive]}
              numberOfLines={1}
            >
              {course.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};
