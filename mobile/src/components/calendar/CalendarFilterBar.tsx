import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../styles/theme';
import { FilterDropdown } from '../ui/FilterDropdown';

interface CalendarFilterBarProps {
  selectedCourseName: string | null;
  selectedSubjectName: string | null;
  isActiveCourse: boolean;
  isActiveSubject: boolean;
  onPressCourse: () => void;
  onPressSubject: () => void;
  showSubjectFilter: boolean;
}

export const CalendarFilterBar: React.FC<CalendarFilterBarProps> = ({
  selectedCourseName,
  selectedSubjectName,
  isActiveCourse,
  isActiveSubject,
  onPressCourse,
  onPressSubject,
  showSubjectFilter,
}) => {
  return (
    <View style={styles.container}>
      <FilterDropdown
        label="Curso"
        value={selectedCourseName}
        iconName="folder"
        onPress={onPressCourse}
        isActive={isActiveCourse}
      />
      {showSubjectFilter && (
        <FilterDropdown
          label="Materia"
          value={selectedSubjectName}
          iconName="book"
          onPress={onPressSubject}
          isActive={isActiveSubject}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
});
