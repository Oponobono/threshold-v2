import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { theme } from '../../../styles/theme';
import { searchBarStyles as styles } from './ExpandableSearchBar.styles';

export interface ExpandableSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onClear?: () => void;
}

export const ExpandableSearchBar: React.FC<ExpandableSearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  onClear,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <Feather name="search" size={16} color={theme.colors.text.secondary} style={{ marginRight: 8 }} />
        <TextInput
          autoFocus={autoFocus}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.placeholder}
          style={styles.input}
          returnKeyType="search"
        />
        {value.length > 0 && onClear && (
          <TouchableOpacity onPress={onClear}>
            <Ionicons name="close-circle" size={18} color={theme.colors.text.placeholder} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
