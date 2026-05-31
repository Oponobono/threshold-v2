import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLocalAIStore } from '../../store/useLocalAIStore';
import { theme } from '../../styles/theme';

interface OfflineIndicatorProps {
  size?: 'small' | 'default';
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ size = 'default' }) => {
  const { t } = useTranslation();
  const forceOfflineMode = useLocalAIStore((s) => s.forceOfflineMode);

  if (!forceOfflineMode) return null;

  const isSmall = size === 'small';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name="shield-checkmark" size={11} color={theme.colors.warning} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.warning }}>
        {t('settings.localAI.offlineIndicator', 'Offline')}
      </Text>
    </View>
  );
};
