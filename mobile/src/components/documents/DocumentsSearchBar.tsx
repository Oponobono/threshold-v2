import React from 'react';
import { Animated, View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { documentsStyles as styles } from '../../styles/DocumentsScreen.styles';

interface Props {
  searchAnim: Animated.Value;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  inputRef: React.RefObject<TextInput>;
}

export const DocumentsSearchBar: React.FC<Props> = ({ searchAnim, searchQuery, onSearchChange, inputRef }) => {
  const maxHeight = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] });
  const opacity = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ maxHeight, opacity, overflow: 'hidden', backgroundColor: theme.colors.card, paddingHorizontal: theme.spacing.lg, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.inputBackground, borderRadius: 10, paddingHorizontal: 10, height: 40 }}>
        <Ionicons name="search" size={18} color={theme.colors.text.secondary} />
        <TextInput
          ref={inputRef}
          style={{ flex: 1, marginLeft: 8, fontSize: 14, color: theme.colors.text.primary }}
          placeholder="Buscar documentos..."
          placeholderTextColor={theme.colors.text.secondary}
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};
