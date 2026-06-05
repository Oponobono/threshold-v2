import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsStyles as s } from '../../styles/FlashcardsModal.styles';
import { Subject, updateFlashcardDeck, type FlashcardDeck } from '../../services/api';
import { useCustomAlert } from '../ui/CustomAlert';


interface Props {
  deck: FlashcardDeck;
  subjects: Subject[];
  onBack: () => void;
  onDeckUpdated: () => void;
}

/**
 * FlashcardEditDeckScreen.tsx
 *
 * Modal para editar un mazo existente.
 * Permite cambiar el nombre y la materia asociada.
 *
 * @param deck - Mazo a editar
 * @param subjects - Lista de materias del usuario
 * @param onBack - Callback para cancelar
 * @param onDeckUpdated - Callback ejecutado tras actualizar el mazo exitosamente
 */
export const FlashcardEditDeckScreen: React.FC<Props> = ({ deck, subjects, onBack, onDeckUpdated }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

  const [deckTitle, setDeckTitle] = useState(deck.title);
  const [deckSubjectId, setDeckSubjectId] = useState<string | null>(deck.subject_id || null);
  const [isSavingDeck, setIsSavingDeck] = useState(false);

  const handleSaveDeck = async () => {
    if (!deckTitle.trim()) {
      showAlert({ title: t('common.error'), message: t('flashcards.deckFormError'), type: 'warning' });
      return;
    }
    try {
      setIsSavingDeck(true);
      await updateFlashcardDeck(deck.id, { 
        subject_id: deckSubjectId || undefined, 
        title: deckTitle.trim() 
      });
      onDeckUpdated();
    } catch (e: any) {
      showAlert({ title: t('common.error'), message: e.message || t('flashcards.deckSaveError'), type: 'error' });
    } finally {
      setIsSavingDeck(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      <View>
          <View style={[s.modalHeader, { justifyContent: 'space-between', marginBottom: 16 }]}>
            <Text style={[s.modalTitle, { flex: 1, textAlign: 'left' }]}>{t('flashcards.editDeck')}</Text>
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <Text style={s.formLabel}>{t('flashcards.deckName')}</Text>
          <TextInput
            style={s.input}
            value={deckTitle}
            onChangeText={setDeckTitle}
            placeholder={t('flashcards.deckNamePlaceholder')}
            placeholderTextColor={theme.colors.text.placeholder}
          />

          <Text style={[s.formLabel, { marginTop: 16 }]}>{t('flashcards.subject')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subjectScrollContainer}
          >
            <TouchableOpacity
              style={[
                styles.subjectItem,
                deckSubjectId === null && {
                  backgroundColor: theme.colors.primary + '20',
                  borderColor: theme.colors.primary,
                  borderWidth: 1.5,
                },
              ]}
              onPress={() => setDeckSubjectId(null)}
            >
              <Text style={[styles.subjectName, deckSubjectId === null && { color: theme.colors.primary, fontWeight: '700' }]}>
                {t('flashcards.noSubject')}
              </Text>
              {deckSubjectId === null && (
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} style={{ marginLeft: 6 }} />
              )}
            </TouchableOpacity>
            {subjects.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.subjectItem,
                  deckSubjectId === sub.id && {
                    backgroundColor: (sub.color || theme.colors.primary) + '20',
                    borderColor: sub.color || theme.colors.primary,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setDeckSubjectId(sub.id)}
              >
                <View style={[styles.subjectBadge, { backgroundColor: sub.color || '#CCC' }]}>
                  <MaterialCommunityIcons name={(sub.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']) || 'book-outline'} size={14} color="white" />
                </View>
                <Text style={[styles.subjectName, deckSubjectId === sub.id && { color: sub.color || theme.colors.primary, fontWeight: '700' }]}>
                  {sub.name}
                </Text>
                {deckSubjectId === sub.id && (
                  <Ionicons name="checkmark-circle" size={16} color={sub.color || theme.colors.primary} style={{ marginLeft: 6 }} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitBtn, isSavingDeck && { opacity: 0.6 }, { marginTop: 24 }]}
            onPress={handleSaveDeck}
            disabled={isSavingDeck}
          >
            <Text style={styles.submitBtnText}>{isSavingDeck ? '...' : t('common.save')}</Text>
          </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  subjectScrollContainer: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    gap: 8,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 110,
  },
  subjectBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  subjectName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 12 : 16,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
