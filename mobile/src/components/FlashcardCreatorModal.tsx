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
  ScrollView, Alert, StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFlashcardGenerator } from '../hooks/useFlashcardGenerator';
import { PremiumLoader } from './PremiumLoader';
import { CustomButton } from './CustomButton';
import { StudyModeSelector } from './evaluation/StudyModeSelector';
import { StudyMode } from '../services/api/types';

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
  type: string;
}

export const FlashcardCreatorModal: React.FC<FlashcardCreatorModalProps> = ({
  visible, onClose, onSuccess, content, imageBase64,
  contentType, title, subjectId, userId,
}) => {
  const { t } = useTranslation();
  const { generate, loading, generatedDeck, clearGeneratedDeck } = useFlashcardGenerator();

  const [step, setStep] = useState<'input' | 'preview' | 'complete'>('input');
  const [cardCount, setCardCount] = useState('10');
  const [studyMode, setStudyMode] = useState<StudyMode>('flashcard');
  const [editableCards, setEditableCards] = useState<EditableCard[]>([]);

  const handleGenerateCards = async () => {
    if (!cardCount || parseInt(cardCount) < 1) {
      Alert.alert('Ingresa un número válido de ítems');
      return;
    }
    const count = parseInt(cardCount);
    if (content && content.length < 50) {
      Alert.alert('Contenido muy corto', 'El texto es demasiado corto para generar ítems de calidad.', [
        { text: 'Cancelar', style: 'cancel', onPress: () => setCardCount('5') },
        { text: 'Generar de todas formas', onPress: () => startGeneration(5) },
      ]);
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
      const cards = (result.deck.cards || []).map((card: any, index: number) => ({
        id: card.id || index,
        question: card.content?.front || card.content?.question || card.front || card.question || '',
        answer: card.content?.back || card.content?.correctAnswer?.toString() || card.back || card.answer || '',
        type: card.item_type || 'flashcard',
      }));
      setEditableCards(cards);
      setStep('preview');
    } else {
      Alert.alert('Error', result.error || 'No se pudieron generar los ítems');
    }
  };

  const handleDeleteCard = (id: number | undefined) => {
    if (id === undefined) return;
    setEditableCards(cards => cards.filter(c => c.id !== id));
  };

  const handleSaveDeck = async () => {
    if (editableCards.length === 0) {
      Alert.alert('No hay ítems para guardar');
      return;
    }
    setStep('complete');
    setTimeout(() => {
      onSuccess(generatedDeck?.id || 0);
      handleClose();
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Generar con IA</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {step === 'input' && (
            <View style={styles.inputSection}>
              <Text style={styles.subtitle}>
                La IA analizará el contenido y generará ítems de evaluación de nivel universitario.
              </Text>

              {/* Mode selector */}
              <StudyModeSelector selected={studyMode} onSelect={setStudyMode} />

              <Text style={[styles.label, { marginTop: 20 }]}>Cantidad de ítems</Text>
              <Text style={styles.hint}>Recomendado: 5–15 por sesión</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                keyboardType="number-pad"
                value={cardCount}
                onChangeText={setCardCount}
              />

              <CustomButton
                title="Generar ítems"
                onPress={handleGenerateCards}
                disabled={loading}
                variant="primary"
              />
            </View>
          )}

          {step === 'preview' && (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Revisa los ítems generados</Text>
              <Text style={styles.cardCountText}>{editableCards.length} ítem{editableCards.length !== 1 ? 's' : ''}</Text>

              {editableCards.map((card, index) => (
                <View key={card.id} style={styles.cardPreview}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIndex}>{getTypeLabel(card.type)} Ítem {index + 1}</Text>
                    <TouchableOpacity onPress={() => handleDeleteCard(card.id)}>
                      <Text style={styles.deleteBtn}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardLabel}>Pregunta / Frente</Text>
                  <TextInput
                    style={styles.cardInput}
                    value={card.question}
                    onChangeText={(text) => setEditableCards(cards => cards.map(c => c.id === card.id ? { ...c, question: text } : c))}
                    multiline
                  />
                  {card.type === 'flashcard' && (
                    <>
                      <Text style={styles.cardLabel}>Respuesta / Reverso</Text>
                      <TextInput
                        style={styles.cardInput}
                        value={card.answer}
                        onChangeText={(text) => setEditableCards(cards => cards.map(c => c.id === card.id ? { ...c, answer: text } : c))}
                        multiline
                      />
                    </>
                  )}
                </View>
              ))}

              <CustomButton title="Guardar mazo" onPress={handleSaveDeck} disabled={loading || editableCards.length === 0} variant="primary" />
              <CustomButton title="Cancelar" onPress={handleClose} variant="outline" />
            </View>
          )}

          {step === 'complete' && (
            <View style={styles.completeSection}>
              <Text style={styles.successText}>✓ ¡Mazo creado!</Text>
              <Text style={styles.completeMessage}>Abriendo tu mazo...</Text>
            </View>
          )}
        </ScrollView>

        {loading && <PremiumLoader visible={loading} text="Generando con IA..." />}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', marginTop: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 18, fontWeight: '600' },
  closeBtn: { fontSize: 24, color: '#999' },
  content: { flex: 1, padding: 16 },
  inputSection: { marginTop: 8 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 18, lineHeight: 19 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, color: '#999', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 20 },
  previewSection: { marginTop: 8 },
  previewTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cardCountText: { fontSize: 13, color: '#666', marginBottom: 16 },
  cardPreview: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardIndex: { fontSize: 13, fontWeight: '600', color: '#555' },
  deleteBtn: { fontSize: 13, color: '#ff6b6b' },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#999', marginBottom: 5 },
  cardInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, minHeight: 50 },
  completeSection: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  successText: { fontSize: 20, fontWeight: '700', color: '#4CAF50', marginBottom: 12 },
  completeMessage: { fontSize: 14, color: '#666' },
});
