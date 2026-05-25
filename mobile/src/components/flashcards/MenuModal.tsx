import React from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreateDeck: () => void;
  onImportDeck: () => void;
}

export const MenuModal: React.FC<Props> = ({ visible, onClose, onCreateDeck, onImportDeck }) => {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.menuContainer}>
          <TouchableOpacity
            onPress={() => { onClose(); onCreateDeck(); }}
            activeOpacity={0.7}
            style={[styles.menuOption, styles.menuOptionBorder]}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.menuOptionText}>{t('flashcards.createDeck')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { onClose(); onImportDeck(); }}
            activeOpacity={0.7}
            style={styles.menuOption}
          >
            <Ionicons name="download-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.menuOptionText}>{t('flashcards.importDeck')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
