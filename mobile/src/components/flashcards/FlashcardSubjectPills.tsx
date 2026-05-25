import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';
import type { Subject } from '../../services/api';

interface Props {
  subjects: Subject[];
  activeSubjectId: number | null;
  onSelect: (id: number | null) => void;
}

export const FlashcardSubjectPills: React.FC<Props> = ({ subjects, activeSubjectId, onSelect }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.filterRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillContent}
        style={styles.pillScroll}
      >
        <TouchableOpacity
          onPress={() => onSelect(null)}
          activeOpacity={0.72}
          style={[styles.pill, activeSubjectId === null ? styles.pillActive : styles.pillInactive]}
        >
          <Ionicons
            name="layers-outline"
            size={13}
            color={activeSubjectId === null ? theme.colors.white : theme.colors.text.secondary}
          />
          <Text style={[styles.pillText, activeSubjectId === null ? styles.pillTextActive : styles.pillTextInactive]}>
            {t('common.all', 'Todos')}
          </Text>
        </TouchableOpacity>
        {subjects.map((subject) => {
          const isActive = activeSubjectId === subject.id;
          return (
            <TouchableOpacity
              key={subject.id}
              onPress={() => onSelect(subject.id)}
              activeOpacity={0.72}
              style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
            >
              <View style={[styles.subjectDot, { backgroundColor: subject.color || theme.colors.primary }]} />
              <Text style={[styles.pillText, isActive ? styles.pillTextActive : styles.pillTextInactive]}>
                {subject.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};
