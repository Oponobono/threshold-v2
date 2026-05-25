import React from 'react';
import { View, TextInput, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';

interface Props {
  searchAnim: Animated.Value;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  inputRef: React.RefObject<TextInput>;
}

export const RecordingsSearchBar: React.FC<Props> = ({
  searchAnim, searchQuery, onSearchChange, inputRef,
}) => {
  const { t } = useTranslation();
  return (
    <Animated.View
      style={{
        overflow: 'hidden',
        maxHeight: searchAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 56],
        }),
        opacity: searchAnim,
        backgroundColor: theme.colors.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        paddingHorizontal: theme.spacing.lg,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          borderRadius: 14,
          paddingHorizontal: 12,
          height: 40,
          gap: 8,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Ionicons name="search" size={16} color={theme.colors.text.placeholder} />
        <TextInput
          ref={inputRef}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder={t('recordings.searchPlaceholder')}
          placeholderTextColor={theme.colors.text.placeholder}
          style={{ flex: 1, fontSize: 14, color: theme.colors.text.primary, paddingVertical: 0 }}
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
