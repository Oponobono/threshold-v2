import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { recordingsStyles as styles } from '../../styles/RecordingsScreen.styles';

export const EmptyRecordings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons
        name="microphone-off"
        size={64}
        color={theme.colors.border}
      />
      <Text style={styles.emptyText}>
        {t('dashboard.audioRecorderModal.emptyState')}
      </Text>
    </View>
  );
};
