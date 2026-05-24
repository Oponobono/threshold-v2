import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { galleryStyles } from '../../styles/Gallery.styles';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  t: any;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, onClear, t }) => {
  return (
    <View style={galleryStyles.searchBarContainer}>
      <View style={galleryStyles.searchInner}>
        <Feather name="search" size={16} color={theme.colors.text.secondary} style={{ marginRight: 8 }} />
        <TextInput
          autoFocus
          value={value}
          onChangeText={onChangeText}
          placeholder={t('gallery.searchPlaceholder') || 'Buscar fotos, materias, OCR...'}
          placeholderTextColor={theme.colors.text.placeholder}
          style={galleryStyles.searchInput}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={onClear}>
            <Ionicons name="close-circle" size={18} color={theme.colors.text.placeholder} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
