import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { documentsStyles as styles } from '../../styles/DocumentsScreen.styles';

export const EmptyDocuments: React.FC = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={48} color={theme.colors.text.secondary} />
      <Text style={styles.emptyText}>{t('documents.emptyScreen') || 'No hay documentos disponibles'}</Text>
    </View>
  );
};
