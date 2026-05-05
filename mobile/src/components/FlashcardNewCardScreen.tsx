import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { flashcardsStyles as s } from '../styles/FlashcardsModal.styles';
import { FlashcardDeck, createFlashcard } from '../services/api';
import { useCustomAlert } from './CustomAlert';

interface Props {
  activeDeck: FlashcardDeck | null;
  onBack: () => void;
  onCardCreated: () => void;
}

/**
 * FlashcardNewCardScreen.tsx
 *
 * Sub-pantalla del módulo de flashcards para crear manualmente una tarjeta nueva
 * dentro de un mazo existente. Muestra dos campos de texto multilínea:
 * el "frente" (pregunta) y el "reverso" (respuesta). Al confirmar, llama a
 * `createFlashcard` en la API y notifica al padre para refrescar el hub de mazos.
 *
 * @param activeDeck - El mazo al que se agregará la nueva tarjeta.
 * @param onBack - Callback para regresar al hub sin guardar.
 * @param onCardCreated - Callback ejecutado tras guardar exitosamente la tarjeta.
 */
export const FlashcardNewCardScreen: React.FC<Props> = ({ activeDeck, onBack, onCardCreated }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [isSavingCard, setIsSavingCard] = useState(false);

  const handleSaveCard = async () => {
    if (!cardFront.trim() || !cardBack.trim() || !activeDeck) return;
    try {
      setIsSavingCard(true);
      await createFlashcard({ deck_id: activeDeck.id, front: cardFront.trim(), back: cardBack.trim() });
      setCardFront('');
      setCardBack('');
      onCardCreated();
    } catch (e: any) {
      showAlert({ title: t('common.error'), message: e.message, type: 'error' });
    } finally {
      setIsSavingCard(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={s.modalHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.modalTitle}>{t('flashcards.newCard')}</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={s.deckSubMeta}>{activeDeck?.title}</Text>

      <Text style={s.formLabel}>{t('flashcards.frontLabel')}</Text>
      <TextInput
        style={[s.input, { height: 100, textAlignVertical: 'top' }]}
        value={cardFront}
        onChangeText={setCardFront}
        multiline
        placeholder={t('flashcards.frontPlaceholder')}
        placeholderTextColor={theme.colors.text.placeholder}
      />

      <Text style={s.formLabel}>{t('flashcards.backLabel')}</Text>
      <TextInput
        style={[s.input, { height: 100, textAlignVertical: 'top' }]}
        value={cardBack}
        onChangeText={setCardBack}
        multiline
        placeholder={t('flashcards.backPlaceholder')}
        placeholderTextColor={theme.colors.text.placeholder}
      />

      <TouchableOpacity
        style={[s.newDeckBtn, { marginTop: 28 }, isSavingCard && { opacity: 0.6 }]}
        onPress={handleSaveCard}
        disabled={isSavingCard}
      >
        <Text style={s.newDeckBtnText}>{isSavingCard ? t('common.saving') : t('flashcards.addCard')}</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};
