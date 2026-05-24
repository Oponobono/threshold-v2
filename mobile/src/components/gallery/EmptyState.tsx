import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { galleryStyles } from '../../styles/Gallery.styles';

interface EmptyStateProps {
  icon: string;
  message: string;
  sub?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, sub }) => {
  return (
    <View style={galleryStyles.emptyStateContainer}>
      <View style={galleryStyles.emptyStateIconWrap}>
        <Ionicons name={icon as any} size={32} color={theme.colors.primary} />
      </View>
      <Text style={galleryStyles.emptyStateMessage}>{message}</Text>
      {sub ? <Text style={galleryStyles.emptyStateSub}>{sub}</Text> : null}
    </View>
  );
};
