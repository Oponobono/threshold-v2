import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { documentsStyles as styles } from '../../styles/DocumentsScreen.styles';

interface Props {
  showSearch: boolean;
  onToggleSearch: () => void;
}

export const DocumentsHeader: React.FC<Props> = ({ showSearch, onToggleSearch }) => {
  const { t } = useTranslation();
  return (
    <View style={[styles.headerRow, { paddingLeft: theme.spacing.lg, justifyContent: 'space-between' }]}>
      <Text style={[styles.headerTitle, { flex: 1, textAlign: 'left' }]}>
        {t('documents.screenTitle') || 'Documentos'}
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
      </View>
    </View>
  );
};
