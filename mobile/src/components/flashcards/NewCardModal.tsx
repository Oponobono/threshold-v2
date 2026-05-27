import React from 'react';
import { View, Modal, Pressable } from 'react-native';
import { FlashcardNewCardScreen } from './FlashcardNewCardScreen';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';
import type { FlashcardDeck } from '../../services/api';

interface Props {
  visible: boolean;
  deck: FlashcardDeck | null;
  onClose: () => void;
  onCardCreated: () => void;
}

export const NewCardModal: React.FC<Props> = ({ visible, deck, onClose, onCardCreated }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalPressable} onPress={onClose} />
      <View style={styles.modalSheet}>
        {deck && (
          <FlashcardNewCardScreen
            activeDeck={deck}
            onBack={onClose}
            onCardCreated={onCardCreated}
          />
        )}
      </View>
    </View>
  </Modal>
);
