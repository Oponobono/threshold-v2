import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsScreenStyles as styles } from '../../styles/FlashcardsScreen.styles';
import { useCustomAlert } from '../ui/CustomAlert';
import type { FlashcardDeck, Subject } from '../../services/api';
import { updateFlashcardDeck } from '../../services/api';

interface Props {
  visible: boolean;
  deck: FlashcardDeck | null;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
}

export const EditDeckModal: React.FC<Props> = ({ visible, deck, subjects, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [editing, setEditing] = React.useState<FlashcardDeck | null>(null);

  React.useEffect(() => {
    if (visible && deck) {
      setEditing({ ...deck });
    }
  }, [visible, deck]);

  if (!editing) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.editModalSheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>{t('flashcards.editDeck')}</Text>
              <TouchableOpacity style={styles.editModalClose} onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.editLabel}>{t('flashcards.deckName')}</Text>
            <TextInput
              value={editing.title}
              onChangeText={(text) => setEditing({ ...editing, title: text })}
              style={styles.editInput}
              placeholder={t('flashcards.deckNamePlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
            />

            <Text style={styles.editLabel}>{t('flashcards.subject')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.editSubjectRow}
            >
              <TouchableOpacity
                onPress={() => setEditing({ ...editing, subject_id: null })}
                style={[
                  styles.subjectChipWrapper,
                  editing.subject_id === null ? styles.subjectChipActive : styles.subjectChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.subjectChipLabel,
                    editing.subject_id === null ? styles.subjectChipLabelActive : styles.subjectChipLabelInactive,
                  ]}
                >
                  {t('flashcards.noSubject')}
                </Text>
              </TouchableOpacity>
              {subjects.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  onPress={() => setEditing({ ...editing, subject_id: sub.id })}
                  style={[
                    styles.subjectChipWrapper,
                    { flexDirection: 'row', alignItems: 'center', gap: 6 },
                    editing.subject_id === sub.id ? styles.subjectChipActive : styles.subjectChipInactive,
                  ]}
                >
                  <View style={[styles.subjectChipDot, { backgroundColor: sub.color || '#999' }]} />
                  <Text
                    style={[
                      styles.subjectChipLabel,
                      editing.subject_id === sub.id ? styles.subjectChipLabelActive : styles.subjectChipLabelInactive,
                    ]}
                  >
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={async () => {
                try {
                  // Validar que el título no esté vacío
                  if (!editing.title || !editing.title.trim()) {
                    showAlert({ title: t('common.error'), message: t('flashcards.deckNameRequired'), type: 'error' });
                    return;
                  }

                  // Construir payload - incluir subject_id incluso si es null para permitir deseleccionar
                  const payload: any = {
                    title: editing.title.trim(),
                  };
                  
                  // Enviar subject_id solo si se ha modificado (para evitar problemas con undefined)
                  if ('subject_id' in editing) {
                    payload.subject_id = editing.subject_id;
                    if (editing.subject_id) {
                      const subject = subjects.find(s => s.id === editing.subject_id);
                      if (subject) {
                        payload.subject_name = subject.name;
                        payload.subject_color = subject.color;
                        payload.subject_icon = subject.icon;
                      }
                    } else {
                      payload.subject_name = null;
                      payload.subject_color = null;
                      payload.subject_icon = null;
                    }
                  }

                  await updateFlashcardDeck(editing.id, payload);
                  onClose();
                  onSaved();
                  showAlert({ title: t('common.success'), message: t('flashcards.deckUpdated'), type: 'success' });
                } catch (e: any) {
                  showAlert({ title: t('common.error'), message: e.message, type: 'error' });
                }
              }}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
