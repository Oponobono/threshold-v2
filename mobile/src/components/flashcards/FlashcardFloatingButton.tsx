import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';

interface Props {
  onPress: () => void;
}

export const FlashcardFloatingButton: React.FC<Props> = ({ onPress }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fabContainer, { bottom: Math.max(insets.bottom, 16) + 8 }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.fab}>
        <Ionicons name="add-circle" size={20} color={theme.colors.white} />
        <Text style={styles.fabText}>{t('flashcards.newDeck')}</Text>
      </TouchableOpacity>
    </View>
  );
};
