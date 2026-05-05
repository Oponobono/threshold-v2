import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFlashcardGenerator } from '../hooks/useFlashcardGenerator';
import { PremiumLoader } from './PremiumLoader';
import { CustomButton } from './CustomButton';

interface FlashcardCreatorModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (deckId: number) => void;
  content?: string;
  imageBase64?: string;
  contentType: 'recording' | 'video' | 'image' | 'document';
  title: string;
  subjectId: number;
  userId: number;
}

interface EditableCard {
  id?: number;
  question: string;
  answer: string;
  isDeleted?: boolean;
}

/**
 * FlashcardCreatorModal.tsx
 *
 * Modal de generación automática de flashcards usando el LLM de Groq.
 * Flujo de 3 pasos internos:
 * 1. `input`: El usuario define cuántas tarjetas desea generar.
 * 2. `preview`: Se muestran las tarjetas generadas para edición/eliminación antes de confirmar.
 * 3. `complete`: Pantalla de éxito transitoria antes de cerrar el modal.
 * Acepta contenido de tipo texto (transcripciones/resúmenes) o imagen en base64 para
 * la generación contextual de las tarjetas educativas.
 *
 * @param visible - Controla la visibilidad del modal.
 * @param onClose - Callback para cerrar y limpiar el estado.
 * @param onSuccess - Callback ejecutado con el ID del mazo creado al finalizar.
 * @param content - Texto de transcripción o resumen como fuente de contexto.
 * @param imageBase64 - Imagen codificada en base64 como fuente alternativa de contexto.
 * @param contentType - Tipo de fuente: 'recording', 'video', 'image' o 'document'.
 * @param title - Título sugerido para el mazo de flashcards.
 * @param subjectId - ID de la materia a la que pertenecerá el mazo.
 * @param userId - ID del usuario propietario del mazo.
 */
export const FlashcardCreatorModal: React.FC<FlashcardCreatorModalProps> = ({
  visible,
  onClose,
  onSuccess,
  content,
  imageBase64,
  contentType,
  title,
  subjectId,
  userId,
}) => {
  const { t } = useTranslation();
  const { generate, loading, error, generatedDeck, clearGeneratedDeck } = useFlashcardGenerator();

  const [step, setStep] = useState<'input' | 'preview' | 'complete'>('input');
  const [cardCount, setCardCount] = useState('10');
  const [editableCards, setEditableCards] = useState<EditableCard[]>([]);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);

  const handleGenerateCards = async () => {
    if (!cardCount || parseInt(cardCount) < 1) {
      Alert.alert(t('common.errors.fillAllFields'));
      return;
    }

    const count = parseInt(cardCount);

    // Validar longitud mínima del contenido si es texto
    if (content && content.length < 50) {
      Alert.alert(t('flashcards.generate.tooShort', { count, recommended: 5 }), '', [
        {
          text: t('flashcards.generate.cancel'),
          onPress: () => setCardCount('5'),
          style: 'cancel',
        },
        {
          text: t('flashcards.generate.generate'),
          onPress: async () => await startGeneration(5),
        },
      ]);
      return;
    }

    await startGeneration(count);
  };

  const startGeneration = async (count: number) => {
    const result = await generate({
      text: content,
      imageBase64: imageBase64,
      count,
      title,
      subjectId,
      userId,
    });

    if (result.success && result.deck) {
      const cards = (result.deck.cards || []).map((card: any, index: number) => ({
        id: card.id || index,
        question: card.front || card.question || '',
        answer: card.back || card.answer || '',
      }));
      setEditableCards(cards);
      setStep('preview');
    } else {
      Alert.alert(t('flashcards.generate.errors.generationFailed'), result.error);
    }
  };

  const handleDeleteCard = (id: number | undefined) => {
    if (id === undefined) return;
    setEditableCards((cards) => cards.filter((c) => c.id !== id));
  };

  const handleUpdateCard = (id: number | undefined, question: string, answer: string) => {
    if (id === undefined) return;
    setEditableCards((cards) =>
      cards.map((c) => (c.id === id ? { ...c, question, answer } : c))
    );
  };

  const handleSaveDeck = async () => {
    if (editableCards.length === 0) {
      Alert.alert(t('flashcards.noCardsMsg'));
      return;
    }

    // Aquí iríamos a guardar el mazo con las tarjetas editadas
    // Por ahora, asumimos que ya está guardado desde la API
    setStep('complete');
    setTimeout(() => {
      onSuccess(generatedDeck?.id || 0);
      handleClose();
    }, 1500);
  };

  const handleClose = () => {
    setStep('input');
    setCardCount('10');
    setEditableCards([]);
    setEditingCardId(null);
    clearGeneratedDeck();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('flashcards.generate.title')}</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.content}>
          {step === 'input' && (
            <View style={styles.inputSection}>
              <Text style={styles.subtitle}>{t('flashcards.generate.subtitle')}</Text>
              <Text style={styles.label}>{t('flashcards.generate.countLabel')}</Text>
              <Text style={styles.hint}>{t('flashcards.generate.countHint')}</Text>

              <TextInput
                style={styles.input}
                placeholder="10"
                keyboardType="number-pad"
                value={cardCount}
                onChangeText={setCardCount}
              />

              <CustomButton
                title={t('flashcards.generate.generate')}
                onPress={handleGenerateCards}
                disabled={loading}
                variant="primary"
              />
            </View>
          )}

          {step === 'preview' && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>{t('flashcards.generate.preview')}</Text>
              <Text style={styles.cardCountText}>
                {editableCards.length} {t('flashcards.cards')}
              </Text>

              {editableCards.map((card, index) => (
                <View key={card.id} style={styles.cardPreview}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIndex}>Tarjeta {index + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteCard(card.id)}>
                      <Text style={styles.deleteBtn}>{t('flashcards.generate.delete')}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.cardLabel}>{t('flashcards.frontLabel')}</Text>
                  <TextInput
                    style={styles.cardInput}
                    placeholder={t('flashcards.frontPlaceholder')}
                    value={card.question}
                    onChangeText={(text) => handleUpdateCard(card.id, text, card.answer)}
                    multiline
                  />

                  <Text style={styles.cardLabel}>{t('flashcards.backLabel')}</Text>
                  <TextInput
                    style={styles.cardInput}
                    placeholder={t('flashcards.backPlaceholder')}
                    value={card.answer}
                    onChangeText={(text) => handleUpdateCard(card.id, card.question, text)}
                    multiline
                  />
                </View>
              ))}

              <CustomButton
                title={t('flashcards.generate.accept')}
                onPress={handleSaveDeck}
                disabled={loading || editableCards.length === 0}
                variant="primary"
              />
              <CustomButton
                title={t('flashcards.generate.cancel')}
                onPress={handleClose}
                variant="outline"
              />
            </View>
          )}

          {step === 'complete' && (
            <View style={styles.completeSection}>
              <Text style={styles.successText}>✓ {t('flashcards.generate.success')}</Text>
              <Text style={styles.completeMessage}>
                {t('flashcards.generate.loading')}
              </Text>
            </View>
          )}
        </ScrollView>

        {loading && <PremiumLoader visible={loading} text={t('flashcards.generate.generating')} />}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    fontSize: 24,
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputSection: {
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  previewSection: {
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardCountText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  cardPreview: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIndex: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  deleteBtn: {
    fontSize: 13,
    color: '#ff6b6b',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    marginBottom: 6,
  },
  cardInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    marginBottom: 12,
    minHeight: 50,
  },
  completeSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 12,
  },
  completeMessage: {
    fontSize: 14,
    color: '#666',
  },
});
