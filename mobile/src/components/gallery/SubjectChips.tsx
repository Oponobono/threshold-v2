import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../styles/theme';
import { galleryStyles } from '../../styles/Gallery.styles';

interface SubjectChipsProps {
  subjects: any[];
  selectedSubjectId: number | null;
  onSelectSubject: (id: number | null) => void;
  t: any;
}

export const SubjectChips: React.FC<SubjectChipsProps> = ({
  subjects,
  selectedSubjectId,
  onSelectSubject,
  t,
}) => {
  if (subjects.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={galleryStyles.subjectChipsScroll}
      contentContainerStyle={galleryStyles.subjectChipsContent}
    >
      <TouchableOpacity
        onPress={() => onSelectSubject(null)}
        style={[
          galleryStyles.subjectChip,
          selectedSubjectId === null && galleryStyles.subjectChipActive,
        ]}
      >
        <Text
          style={[
            galleryStyles.subjectChipText,
            selectedSubjectId === null && galleryStyles.subjectChipTextActive,
          ]}
        >
          {t('gallery.allSubjects') || 'Todas las materias'}
        </Text>
      </TouchableOpacity>
      {subjects.map((s) => (
        <TouchableOpacity
          key={s.id}
          onPress={() => onSelectSubject(selectedSubjectId === s.id ? null : s.id)}
          style={[
            galleryStyles.subjectChip,
            selectedSubjectId === s.id && galleryStyles.subjectChipActive,
          ]}
        >
          <Text
            style={[
              galleryStyles.subjectChipText,
              selectedSubjectId === s.id && galleryStyles.subjectChipTextActive,
            ]}
          >
            {s.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
