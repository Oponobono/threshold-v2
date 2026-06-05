import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';
import { syncQueueRepository } from '../../services/database';

interface Props {
  showSearch: boolean;
  onToggleSearch: () => void;
  onOpenMenu: () => void;
}

export const FlashcardHeader: React.FC<Props> = ({ showSearch, onToggleSearch, onOpenMenu }) => {
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    syncQueueRepository.countPending().then(setPendingCount);
  }, []);

  return (
    <View style={styles.headerRow}>
      <Text style={styles.headerTitle}>
        {t('flashcards.decks')}
      </Text>
      <View style={styles.headerActions}>
        {pendingCount > 0 && (
          <View style={{
            backgroundColor: theme.colors.warning,
            borderRadius: 10,
            paddingHorizontal: 7,
            paddingVertical: 2,
            marginRight: 4,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
              {pendingCount}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.backBtn, showSearch && styles.searchBtnActive]}
          onPress={onToggleSearch}
        >
          <Ionicons
            name={showSearch ? 'search' : 'search-outline'}
            size={22}
            color={showSearch ? theme.colors.primary : theme.colors.text.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={onOpenMenu}>
          <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
