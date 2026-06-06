import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsStyles as s } from '../../styles/FlashcardsModal.styles';
import { Subject, createFlashcardDeck } from '../../services/api';
import { useCustomAlert } from '../ui/CustomAlert';


interface Props {
  subjects: Subject[];
  onBack: () => void;
  onDeckCreated: () => void;
}

/**
 * FlashcardNewDeckScreen.tsx
 *
 * Sub-pantalla del módulo de flashcards para crear un mazo de tarjetas nuevo.
 * Recoge el título, una descripción opcional y la materia asociada mediante
 * chips seleccionables. Al confirmar, crea el mazo en el servidor y regresa
 * al hub actualizando la lista de mazos disponibles.
 *
 * @param subjects - Lista de materias del usuario para asignar al mazo.
 * @param onBack - Callback para cancelar y regresar al hub.
 * @param onDeckCreated - Callback ejecutado tras crear el mazo exitosamente.
 */
export const FlashcardNewDeckScreen: React.FC<Props> = ({ subjects, onBack, onDeckCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

  const [deckTitle, setDeckTitle] = useState('');
  const [deckDesc, setDeckDesc] = useState('');
  const [deckSubjectId, setDeckSubjectId] = useState<string | null>(null);
  const [isSavingDeck, setIsSavingDeck] = useState(false);

  const handleSaveDeck = async () => {
    if (!deckTitle.trim()) {
      showAlert({ title: t('common.error'), message: t('flashcards.deckFormError'), type: 'warning' });
      return;
    }
    try {
      setIsSavingDeck(true);
      await createFlashcardDeck({
        ...(deckSubjectId ? { subject_id: deckSubjectId } : {}),
        title: deckTitle.trim(),
        description: deckDesc.trim(),
      });
      setDeckTitle('');
      setDeckDesc('');
      setDeckSubjectId(null);
      onDeckCreated();
    } catch (e: any) {
      showAlert({ title: t('common.error'), message: e.message || t('flashcards.deckSaveError'), type: 'error' });
    } finally {
      setIsSavingDeck(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={[s.modalHeader, { justifyContent: 'space-between' }]}>
        <Text style={[s.modalTitle, { flex: 1, textAlign: 'left' }]}>{t('flashcards.newDeck')}</Text>
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

      <Text style={s.formLabel}>{t('flashcards.deckDesc')}</Text>
      <TextInput
        style={[s.input, { height: 72, textAlignVertical: 'top' }]}
        value={deckDesc}
        onChangeText={setDeckDesc}
        multiline
        placeholder={t('flashcards.deckDescPlaceholder')}
        placeholderTextColor={theme.colors.text.placeholder}
      />

      <Text style={s.formLabel}>{t('flashcards.subject')}</Text>
      <View style={s.subjectsWrap}>
        {subjects.map((sub) => (
          <TouchableOpacity
            key={sub.id}
            style={[s.subjectChip, deckSubjectId === sub.id && s.subjectChipActive]}
            onPress={() => setDeckSubjectId(sub.id)}
          >
            <View style={[s.subjectChipDot, { backgroundColor: sub.color || '#CCC' }]} />
            <Text style={[s.subjectChipText, deckSubjectId === sub.id && { color: theme.colors.primary, fontWeight: '600' }]}>
              {sub.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[s.newDeckBtn, { marginTop: 28 }, isSavingDeck && { opacity: 0.6 }]}
        onPress={handleSaveDeck}
        disabled={isSavingDeck}
      >
        <Text style={s.newDeckBtnText}>{isSavingDeck ? t('common.saving') : t('flashcards.createDeck')}</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};
