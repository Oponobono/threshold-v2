import React from 'react';
import { FlatList, TouchableOpacity, Text } from 'react-native';
import { theme } from '../../styles/theme';
import { gradesStyles } from '../../styles/Grades.styles';

interface SubjectFilterBarProps {
  subjects: any[];
  selectedSubjectId: string | null;
  onSelectSubject: (id: string | null) => void;
  t: any;
}

export const SubjectFilterBar: React.FC<SubjectFilterBarProps> = ({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  t,
}) => {
  return (
    <FlatList
      horizontal
      data={subjects}
      keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
      showsHorizontalScrollIndicator={false}
      style={{ maxHeight: 46, flexGrow: 0, minHeight: 46 }}
      contentContainerStyle={gradesStyles.subjectFilterContent}
      removeClippedSubviews={true}
      maxToRenderPerBatch={8}
      initialNumToRender={5}
      windowSize={5}
      ListHeaderComponent={
        <TouchableOpacity
          style={[
            gradesStyles.subjectFilterChip,
            selectedSubjectId === null && gradesStyles.subjectFilterChipActive,
            selectedSubjectId === null && { borderColor: theme.colors.primary },
          ]}
          onPress={() => onSelectSubject(null)}
        >
          <Text
            style={[
              gradesStyles.subjectFilterChipText,
              selectedSubjectId === null && gradesStyles.subjectFilterChipTextActive,
            ]}
          >
            {t('common.all', 'Todas')}
          </Text>
        </TouchableOpacity>
      }
      renderItem={({ item: sub }) => (
        <TouchableOpacity
          style={[
            gradesStyles.subjectFilterChip,
            selectedSubjectId === sub.id && {
              backgroundColor: sub.color || theme.colors.primary,
              borderColor: sub.color || theme.colors.primary,
            },
          ]}
          onPress={() => onSelectSubject(sub.id)}
        >
          <Text
            style={[
              gradesStyles.subjectFilterChipText,
              selectedSubjectId === sub.id && gradesStyles.subjectFilterChipTextActive,
            ]}
          >
            {sub.name}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
};
