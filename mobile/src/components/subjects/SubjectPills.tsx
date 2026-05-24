import React from 'react';
import { FlatList, TouchableOpacity, Text, View } from 'react-native';
import { subjectsStyles } from '../../styles/Subjects.styles';
import { Subject } from '../../services/api/types';
import { getPillColor } from '../../hooks/useSubjects';

interface SubjectPillsProps {
  subjects: any[];
  selectedSubject: Subject | null;
  onSelect: (s: Subject) => void;
}

export const SubjectPills: React.FC<SubjectPillsProps> = ({ subjects, selectedSubject, onSelect }) => {
  return (
    <FlatList
      horizontal
      data={subjects}
      keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
      showsHorizontalScrollIndicator={false}
      style={subjectsStyles.pillsScroll}
      contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 6, gap: 6, alignItems: 'center' }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={8}
      initialNumToRender={5}
      windowSize={5}
      renderItem={({ item: s, index: idx }) => {
        const color = getPillColor(s, idx);
        const isActive = selectedSubject?.id === s.id;

        return (
          <TouchableOpacity
            style={[subjectsStyles.pill, isActive && subjectsStyles.pillActive]}
            onPress={() => onSelect(s)}
            activeOpacity={0.7}
          >
            <View style={[subjectsStyles.pillColor, { backgroundColor: s.color || color }]} />
            <Text style={[subjectsStyles.pillText, isActive && subjectsStyles.pillTextActive]}>
              {s.name}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
};
