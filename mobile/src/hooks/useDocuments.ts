import { useRef, useState, useCallback } from 'react';
import { Animated, TextInput } from 'react-native';
import { useDocumentsManager } from './useDocumentsManager';

export function useDocuments() {
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null) as React.RefObject<TextInput>;
  const [showSearch, setShowSearch] = useState(false);

  const manager = useDocumentsManager();

  const toggleSearch = useCallback(() => {
    const opening = !showSearch;
    setShowSearch(opening);
    Animated.spring(searchAnim, {
      toValue: opening ? 1 : 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
    if (opening) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    } else {
      manager.setSearchQuery('');
    }
  }, [showSearch, searchAnim, manager.setSearchQuery]);

  return {
    ...manager,
    showSearch,
    searchAnim,
    searchInputRef,
    toggleSearch,
  };
}
