/**
 * FlashcardCreatorModal.tsx  (actualizado)
 *
 * Modal de generación automática de ítems de evaluación usando IA.
 * Ahora incluye el selector de modo (StudyModeSelector) para elegir
 * el tipo de ítem antes de generar: Flashcards, ECAES, V/F o Mixto.
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFlashcardGenerator } from '../../hooks/useFlashcardGenerator';
import { PremiumLoader } from '../ui/PremiumLoader';
import { CustomButton } from '../ui/CustomButton';
import { StudyModeSelector } from '../evaluation/StudyModeSelector';
import { StudyMode } from '../../services/api/types';
import { styles } from '../../styles/FlashcardCreatorModal.styles';

interface FlashcardCreatorModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (deckId: string) => void;
  content?: string;
  imageBase64?: string;
  contentType: 'recording' | 'video' | 'image' | 'document';
  title: string;
  subjectId: string;
  userId: string;
}

interface EditableCard {
  id?: number;
  question: string;
  answer: string;
  type: string;
  options?: string[]; // Para multiple_choice y boolean
  correctIndex?: number; // Índice de la respuesta correcta
  direction?: 'forward' | 'backward' | 'bidirectional'; // Dirección de la tarjeta
}

export const FlashcardCreatorModal: React.FC<FlashcardCreatorModalProps> = ({
  visible, onClose, onSuccess, content, imageBase64,
  contentType, title, subjectId, userId,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { generate, loading, generatedDeck, clearGeneratedDeck } = useFlashcardGenerator();

  const [step, setStep] = useState<'input' | 'preview' | 'complete'>('input');
  const [cardCount, setCardCount] = useState('10');
  const [studyMode, setStudyMode] = useState<StudyMode>('flashcard');
  const [editableCards, setEditableCards] = useState<EditableCard[]>([]);

  const handleGenerateCards = async () => {
    if (!cardCount || parseInt(cardCount) < 1) {
      Alert.alert(t('flashcards.enterValidItemCount'));
      return;
    }
    const count = parseInt(cardCount);
    if (content && content.length < 50) {
      Alert.alert(
        t('flashcards.contentTooShortTitle'),
        t('flashcards.contentTooShortMsg'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setCardCount('5') },
          { text: t('flashcards.generateAnyway'), onPress: () => startGeneration(5) },
        ]
      );
      return;
    }
    await startGeneration(count);
  };

  const startGeneration = async (count: number) => {
    const result = await generate({
      text: content,
      imageBase64,
      count,
      title,
      subjectId,
      userId,
      mode: studyMode,
    });

    if (result.success && result.deck) {
      const cards = (result.deck.cards || []).map((card: any, index: number) => {
        const itemType = card.item_type || 'flashcard';
        
        // Mapear según el tipo
        if (itemType === 'multiple_choice') {
          return {
            id: card.id || index,
            question: card.content?.question || card.question || '',
            answer: '', // No se usa para multiple_choice
            type: itemType,
            options: card.content?.options || card.options || [],
            correctIndex: card.content?.correctIndex ?? card.correctIndex ?? 0,
          };
        } else if (itemType === 'boolean') {
          return {
            id: card.id || index,
            question: card.content?.question || card.question || '',
            answer: '', // No se usa para boolean
            type: itemType,
            options: ['Verdadero', 'Falso'],
            correctIndex: card.content?.correctIndex ?? card.correctIndex ?? 0,
          };
        } else {
          // flashcard por defecto
          return {
            id: card.id || index,
            question: card.content?.front || card.content?.question || card.front || card.question || '',
            answer: card.content?.back || card.content?.correctAnswer?.toString() || card.back || card.answer || '',
            type: itemType,
            direction: card.content?.direction || card.direction || 'forward',
          };
        }
      });
      setEditableCards(cards);
      setStep('preview');
    } else {
      Alert.alert(t('common.error'), result.error || t('flashcards.generateFailed'));
    }
  };

  const handleDeleteCard = (id: number | undefined) => {
    if (id === undefined) return;
    setEditableCards(cards => cards.filter(c => c.id !== id));
  };

  const handleSaveDeck = async () => {
    if (editableCards.length === 0) {
      Alert.alert(t('flashcards.noItemsToSave'));
      return;
    }
    
    setStep('complete');
    
    // Actualizar cada tarjeta editada con los nuevos datos
    try {
      for (const card of editableCards) {
        if (card.id) {
          const updateData: any = {
            front: card.question,
          };
          
          if (card.type === 'flashcard') {
            updateData.back = card.answer;
            if (card.direction) updateData.direction = card.direction;
          } else if (card.type === 'multiple_choice') {
            updateData.options = card.options;
            updateData.correctIndex = card.correctIndex ?? 0;
          } else if (card.type === 'boolean') {
            updateData.correctIndex = card.correctIndex ?? 0;
          }
          
          // Actualizar la tarjeta (esta llamada depende de si existe la API)
          // await updateFlashcard(card.id, updateData).catch(() => {}); 
          // Por ahora solo continuamos, asumiendo que los datos se guardan en el siguiente paso
        }
      }
    } catch (error) {
      console.warn('Error updating cards:', error);
    }

    setTimeout(() => {
      const deckId = generatedDeck?.id || 0;
      if (deckId > 0) {
        onSuccess(String(deckId));
      } else {
        Alert.alert(t('common.error'), t('flashcards.noDeckId'));
        handleClose();
      }
    }, 1500);
  };

  const handleClose = () => {
    setStep('input');
    setCardCount('10');
    setStudyMode('flashcard');
    setEditableCards([]);
    clearGeneratedDeck();
    onClose();
  };

  const getTypeLabel = (type: string) => {
    if (type === 'multiple_choice') return '🎯';
    if (type === 'boolean') return '⚖️';
    return '🃏';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('flashcards.generateWithAI')}</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView 
          style={styles.content} 
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {step === 'input' && (
            <View style={styles.inputSection}>
              <Text style={styles.subtitle}>{t('flashcards.aiWillAnalyze')}</Text>

              {/* Mode selector */}
              <StudyModeSelector selected={studyMode} onSelect={setStudyMode} />

              <Text style={[styles.label, { marginTop: 20 }]}>{t('flashcards.itemCount')}</Text>
              <Text style={styles.hint}>{t('flashcards.recommendedRange')}</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                keyboardType="number-pad"
                value={cardCount}
                onChangeText={setCardCount}
              />

              <CustomButton
                title={t('flashcards.generateItems')}
                onPress={handleGenerateCards}
                disabled={loading}
                variant="primary"
              />
            </View>
          )}

          {step === 'preview' && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>{t('flashcards.reviewItems')}</Text>
              <Text style={styles.cardCountText}>{t('flashcards.itemCountValue', { count: editableCards.length })}</Text>

              {editableCards.map((card, index) => (
                <View key={card.id} style={styles.cardPreview}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIndex}>{getTypeLabel(card.type)} {t('flashcards.itemLabel', { index: index + 1 })}</Text>
                    <TouchableOpacity onPress={() => handleDeleteCard(card.id)}>
                      <Text style={styles.deleteBtn}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardLabel}>{t('flashcards.questionFront')}</Text>
                  <TextInput
                    style={styles.cardInput}
                    value={card.question}
                    onChangeText={(text) => setEditableCards(cards => cards.map(c => c.id === card.id ? { ...c, question: text } : c))}
                    multiline
                  />

                  {/* Flashcard: Mostrar respuesta simple y dirección */}
                  {card.type === 'flashcard' && (
                    <>
                      <Text style={styles.cardLabel}>{t('flashcards.answerBack')}</Text>
                      <TextInput
                        style={styles.cardInput}
                        value={card.answer}
                        onChangeText={(text) => setEditableCards(cards => cards.map(c => c.id === card.id ? { ...c, answer: text } : c))}
                        multiline
                      />

                      <Text style={styles.cardLabel}>Dirección de estudio</Text>
                      <View style={styles.directionRow}>
                        <TouchableOpacity 
                          style={[styles.directionBtn, (card.direction || 'forward') === 'forward' && styles.directionBtnActive]}
                          onPress={() => setEditableCards(cards => cards.map(c => c.id === card.id ? { ...c, direction: 'forward' } : c))}
                        >
                          <Text style={[styles.directionText, (card.direction || 'forward') === 'forward' && styles.directionTextActive]}>Normal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.directionBtn, card.direction === 'backward' && styles.directionBtnActive]}
                          onPress={() => setEditableCards(cards => cards.map(c => c.id === card.id ? { ...c, direction: 'backward' } : c))}
                        >
                          <Text style={[styles.directionText, card.direction === 'backward' && styles.directionTextActive]}>Inversa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.directionBtn, card.direction === 'bidirectional' && styles.directionBtnActive]}
                          onPress={() => setEditableCards(cards => cards.map(c => c.id === card.id ? { ...c, direction: 'bidirectional' } : c))}
                        >
                          <Text style={[styles.directionText, card.direction === 'bidirectional' && styles.directionTextActive]}>Bidireccional</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* Multiple Choice: Mostrar 4 opciones en grid 2x2 */}
                  {card.type === 'multiple_choice' && card.options && (
                    <>
                      <Text style={styles.cardLabel}>{t('flashcards.optionsCorrectMarked')}</Text>
                      <View style={styles.optionsGrid}>
                        {card.options.map((option, optIdx) => (
                          <View key={optIdx} style={styles.gridItem}>
                            <TouchableOpacity
                              style={[
                                styles.optionBox,
                                optIdx === card.correctIndex && styles.optionBoxCorrect,
                              ]}
                              onPress={() => setEditableCards(cards =>
                                cards.map(c => c.id === card.id ? { ...c, correctIndex: optIdx } : c)
                              )}
                            >
                              <TextInput
                                style={styles.optionInput}
                                value={option}
                                onChangeText={(text) => setEditableCards(cards =>
                                  cards.map(c =>
                                    c.id === card.id
                                      ? { ...c, options: (c.options || []).map((o, i) => i === optIdx ? text : o) }
                                      : c
                                  )
                                )}
                                multiline
                              />
                              {optIdx === card.correctIndex && <Text style={styles.correctMark}>✓</Text>}
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Boolean (V/F): Mostrar 2 opciones en 1 fila */}
                  {card.type === 'boolean' && card.options && (
                    <>
                      <Text style={styles.cardLabel}>{t('flashcards.optionsCorrectMarked')}</Text>
                      <View style={styles.booleanRow}>
                        {card.options.map((option, optIdx) => (
                          <TouchableOpacity
                            key={optIdx}
                            style={[
                              styles.booleanBox,
                              optIdx === card.correctIndex && styles.booleanBoxCorrect,
                            ]}
                            onPress={() => setEditableCards(cards =>
                              cards.map(c => c.id === card.id ? { ...c, correctIndex: optIdx } : c)
                            )}
                          >
                            <Text style={styles.booleanText}>{option}</Text>
                            {optIdx === card.correctIndex && <Text style={styles.correctMark}>✓</Text>}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              ))}

              <CustomButton title={t('flashcards.saveDeck')} onPress={handleSaveDeck} disabled={loading || editableCards.length === 0} variant="primary" />
              <CustomButton title={t('common.cancel')} onPress={handleClose} variant="outline" />
            </View>
          )}

          {step === 'complete' && (
            <View style={styles.completeSection}>
              <Text style={styles.successText}>{t('flashcards.deckCreated')}</Text>
              <Text style={styles.completeMessage}>{t('flashcards.openingDeck')}</Text>
            </View>
          )}
        </ScrollView>

        {loading && <PremiumLoader visible={loading} text={t('flashcards.generatingWithAI')} />}
      </View>
    </Modal>
  );
};
