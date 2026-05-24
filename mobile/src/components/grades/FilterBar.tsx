import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../../styles/theme';
import { gradesStyles } from '../../styles/Grades.styles';

interface FilterBarProps {
  t: any;
}

export const FilterBar: React.FC<FilterBarProps> = ({ t }) => {
  return (
    <View style={gradesStyles.filtersContainer}>
      <View style={gradesStyles.filterRow}>
        <TouchableOpacity
          style={[gradesStyles.filterPill, { flex: 1, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border }]}
        >
          <Text style={[gradesStyles.filterText, { color: theme.colors.text.primary }]}>
            {t('grades.dateRange')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={gradesStyles.applyBtn}>
          <Text style={gradesStyles.applyBtnText}>{t('grades.apply')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
