import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { CalendarScope } from '../../types/calendar';
import { ActiveSubject } from '../../hooks/useActiveSubjects';

interface ActiveFilterBannerProps {
  scope: CalendarScope;
  onClear: () => void;
  activeSubjects: ActiveSubject[];
}

export const ActiveFilterBanner: React.FC<ActiveFilterBannerProps> = ({ scope, onClear, activeSubjects }) => {
  if (scope.kind === 'all') return null;

  let filterName = 'General';
  let color = theme.colors.text.placeholder;

  if (scope.kind === 'subject') {
    const subj = activeSubjects.find(s => s.id === scope.subjectId);
    if (subj) {
      filterName = subj.name;
    } else {
      filterName = 'Materia seleccionada';
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Ionicons name="filter" size={14} color={theme.colors.text.secondary} style={styles.icon} />
        <Text style={styles.text}>
          Filtrando por <Text style={styles.highlight}>{filterName}</Text>
        </Text>
      </View>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.clearText}>Ver todas</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  highlight: {
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  }
});
