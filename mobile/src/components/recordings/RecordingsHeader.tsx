import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { recordingsStyles as styles } from '../../styles/RecordingsScreen.styles';

interface Props {
  showSearch: boolean;
  dateFilter: string;
  sortOrder: string;
  onToggleSearch: () => void;
  onOpenYoutube: () => void;
  onOpenFilter: () => void;
}

export const RecordingsHeader: React.FC<Props> = ({
  showSearch, dateFilter, sortOrder, onToggleSearch, onOpenYoutube, onOpenFilter,
}) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.headerRow, { paddingLeft: theme.spacing.lg, justifyContent: 'space-between' }]}>
      <Text style={[styles.headerTitle, { flex: 1, textAlign: 'left' }]}>
        {t('recordings.multimedia')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            showSearch && { backgroundColor: `${theme.colors.primary}12`, borderRadius: 20 },
          ]}
          onPress={onToggleSearch}
        >
          <Ionicons
            name={showSearch ? 'search' : 'search-outline'}
            size={22}
            color={showSearch ? theme.colors.primary : theme.colors.text.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onOpenYoutube}>
          <MaterialCommunityIcons name="youtube" size={26} color={theme.colors.text.error} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onOpenFilter}>
          <Ionicons
            name={dateFilter !== 'all' || sortOrder === 'asc' ? 'filter' : 'filter-outline'}
            size={22}
            color={theme.colors.text.primary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};
