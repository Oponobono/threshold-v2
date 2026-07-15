import React, { useState, useCallback, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchBarStyles as styles } from '../../styles/SearchBar.styles';
import { theme } from '../../styles/theme';
import type { SearchQuery } from '../../domain/document/DocumentSearch';

interface SearchBarProps {
  resultCount: number;
  currentIndex: number;
  onSearch: (query: SearchQuery) => void;
  onNext: () => void;
  onPrev: () => void;
  onClear: () => void;
}

export function SearchBar({
  resultCount,
  currentIndex,
  onSearch,
  onNext,
  onPrev,
  onClear,
}: SearchBarProps) {
  const [text, setText] = useState('');

  // Dynamic search — debounced 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim()) {
        onSearch({ text: text.trim(), caseSensitive: false, wholeWord: false });
      } else {
        onClear();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);

  const handleClear = useCallback(() => {
    setText('');
    onClear();
  }, [onClear]);

  const hasResults = resultCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Buscar en el documento..."
          placeholderTextColor={theme.colors.text.placeholder}
          returnKeyType="search"
          autoFocus
        />
        {text.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Ionicons name="close-circle" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {hasResults && (
        <View style={styles.navRow}>
          <Text style={styles.resultCount}>
            {currentIndex + 1} de {resultCount}
          </Text>
          <View style={styles.navBtns}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={onPrev}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={onNext}
            >
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!hasResults && text.length > 0 && (
        <View style={styles.navRow}>
          <Text style={styles.resultCount}>Sin resultados</Text>
        </View>
      )}
    </View>
  );
}
