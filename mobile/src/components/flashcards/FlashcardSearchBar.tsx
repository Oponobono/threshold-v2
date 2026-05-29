import React from 'react';
import { View, TextInput, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';

interface Props {
  searchAnim: Animated.Value;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  inputRef: React.RefObject<TextInput>;
}

export const FlashcardSearchBar: React.FC<Props> = ({
  searchAnim, searchQuery, onSearchChange, inputRef,
}) => {
  const { t } = useTranslation();
  return (
    <Animated.View
      style={[
        styles.searchBar,
        {
          maxHeight: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 56],
          }),
          opacity: searchAnim,
        },
      ]}
    >
      <View style={styles.searchInputRow}>
        <Ionicons name="search" size={16} color={theme.colors.text.placeholder} />
        <TextInput
          ref={inputRef}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={t('flashcards.deckNamePlaceholder')}
          placeholderTextColor={theme.colors.text.placeholder}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')}>
            <Ionicons name="close-circle" size={16} color={theme.colors.text.placeholder} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};
