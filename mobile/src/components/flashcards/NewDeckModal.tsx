import React from 'react';
import { View, Modal, Pressable } from 'react-native';
import { FlashcardNewDeckScreen } from '../FlashcardNewDeckScreen';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';
import type { Subject } from '../../services/api';

interface Props {
  visible: boolean;
  subjects: Subject[];
  onClose: () => void;
  onDeckCreated: () => void;
}

export const NewDeckModal: React.FC<Props> = ({ visible, subjects, onClose, onDeckCreated }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalPressable} onPress={onClose} />
      <View style={styles.modalSheet}>
        <FlashcardNewDeckScreen
          subjects={subjects}
          onBack={onClose}
          onDeckCreated={onDeckCreated}
        />
      </View>
    </View>
  </Modal>
);
