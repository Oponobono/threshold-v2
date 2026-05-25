import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { recordingsStyles } from '../../styles/RecordingsScreen.styles';

export const EmptyFlashcards: React.FC = () => {
  const { t } = useTranslation();
  return (
    <ScrollView
      contentContainerStyle={[recordingsStyles.listContent, { paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={recordingsStyles.emptyState}>
        <MaterialCommunityIcons
          name="cards-outline"
          size={64}
          color={theme.colors.border}
        />
        <Text style={recordingsStyles.emptyText}>
          {t('flashcards.emptyDecks')}
        </Text>
      </View>
    </ScrollView>
  );
};
