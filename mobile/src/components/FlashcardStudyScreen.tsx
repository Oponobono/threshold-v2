/**
 * FlashcardStudyScreen.tsx  (refactorizado)
 *
 * Sesión de estudio polimórfica que soporta flashcards, selección múltiple y V/F.
 * Usa QuestionRendererFactory (Factory Pattern) para renderizar el componente
 * correcto, y StrategyFactory (Strategy Pattern) para calificar cada respuesta.
 * Mantiene compatibilidad total con mazos legacy (solo front/back).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { FlashcardDeck } from '../services/api/types';
import { EvaluationItem } from '../services/api/types';
import {
  StrategyFactory,
  adaptFlashcardsToEvaluationItems,
} from '../utils/evaluationStrategies';
import { updateFlashcardStatus, createCardLog, deleteFlashcard } from '../services/api';
import { useCustomAlert } from './CustomAlert';
import { QuestionRendererFactory } from './evaluation/QuestionRendererFactory';

interface Props {
  activeDeck: FlashcardDeck | null;
  initialCards: any[];  // Flashcard[] or EvaluationItem[]
  currentUserId: number | null;
  onBack: () => void;
}

// ─── Session Stats ────────────────────────────────────────────────────────────
interface SessionStats {
  correct: number;
  incorrect: number;
  total: number;
}

export const FlashcardStudyScreen: React.FC<Props> = ({
  activeDeck, initialCards, currentUserId, onBack,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

  // Normalizar a EvaluationItem[]
  const [items, setItems] = useState<EvaluationItem[]>([]);
  const [itemIndex, setItemIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState<SessionStats>({ correct: 0, incorrect: 0, total: 0 });
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());

  // Estado específico por tipo
  const [isAnswered, setIsAnswered] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [selectedRating, setSelectedRating] = useState<'learning' | 'review' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null);

  useEffect(() => {
    setItems(adaptFlashcardsToEvaluationItems(initialCards));
    resetItemState();
    setItemIndex(0);
    setSessionDone(false);
    setStats({ correct: 0, incorrect: 0, total: 0 });
    setCardStartTime(Date.now());
  }, [initialCards]);

  const resetItemState = useCallback(() => {
    setIsAnswered(false);
    setIsRevealed(false);
    setSelectedRating(null);
    setSelectedIndex(null);
    setSelectedBoolean(null);
  }, []);

  const handleReveal = useCallback(() => {
    setIsRevealed(true);
  }, []);

  const handleAnswer = useCallback(async (answer: unknown) => {
    if (isAnswered) return;

    const item = items[itemIndex];
    if (!item) return;

    const strategy = StrategyFactory.getStrategy(item.item_type);

    // Para flashcard: requiere reveal primero; si no está revelado, ignora
    if (strategy.requiresReveal && !isRevealed) return;

    const responseTime = Date.now() - cardStartTime;
    const result = strategy.evaluate(item, answer, responseTime);
    const newStatus = strategy.getStatusUpdate(result);

    // Persistir estado de respuesta en UI
    setIsAnswered(true);
    if (item.item_type === 'flashcard') setSelectedRating(answer as 'learning' | 'review');
    if (item.item_type === 'multiple_choice') setSelectedIndex(answer as number);
    if (item.item_type === 'boolean') setSelectedBoolean(answer as boolean);

    // Actualizar stats
    setStats(prev => ({
      ...prev,
      correct: prev.correct + (result.passed ? 1 : 0),
      incorrect: prev.incorrect + (result.passed ? 0 : 1),
      total: prev.total + 1,
    }));

    // Persistir en BD
    try {
      await updateFlashcardStatus(item.id, newStatus);
      await createCardLog({ card_id: item.id, result: newStatus, response_time_ms: responseTime });
    } catch (_) {}

    // Avanzar después de un delay (más largo para MC/Boolean para leer el feedback)
    const delay = item.item_type === 'flashcard' ? 1100 : 1600;
    setTimeout(() => {
      const next = itemIndex + 1;
      if (next >= items.length) {
        setSessionDone(true);
      } else {
        setItemIndex(next);
        resetItemState();
        setCardStartTime(Date.now());
      }
    }, delay);
  }, [isAnswered, isRevealed, items, itemIndex, cardStartTime, resetItemState]);

  const handleDeleteCard = (cardId: number) => {
    showAlert({
      title: 'Eliminar ítem',
      message: '¿Estás seguro de que deseas eliminar este ítem de evaluación?',
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteFlashcard(cardId);
              const updated = items.filter(c => c.id !== cardId);
              setItems(updated);
              if (updated.length === 0) { setSessionDone(true); return; }
              if (itemIndex >= updated.length) setItemIndex(updated.length - 1);
              resetItemState();
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message, type: 'error' });
            }
          },
        },
      ],
    });
  };

  // ─── Session Done screen ───────────────────────────────────────────────────
  if (sessionDone) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <View style={s.sessionDone}>
        <Text style={s.doneEmoji}>{pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</Text>
        <Text style={s.doneTitle}>¡Sesión completada!</Text>
        <Text style={s.doneSubtitle}>{items.length} ítem{items.length !== 1 ? 's' : ''} revisados</Text>
        {stats.total > 0 && (
          <View style={s.statsRow}>
            <View style={[s.statChip, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[s.statChipNum, { color: '#2E7D32' }]}>{stats.correct}</Text>
              <Text style={[s.statChipLabel, { color: '#2E7D32' }]}>Correctas</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: '#FFEBEE' }]}>
              <Text style={[s.statChipNum, { color: '#C62828' }]}>{stats.incorrect}</Text>
              <Text style={[s.statChipLabel, { color: '#C62828' }]}>Incorrectas</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: '#F3E5F5' }]}>
              <Text style={[s.statChipNum, { color: '#6A1B9A' }]}>{pct}%</Text>
              <Text style={[s.statChipLabel, { color: '#6A1B9A' }]}>Acierto</Text>
            </View>
          </View>
        )}
        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backBtnText}>Volver a mazos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const item = items[itemIndex];
  if (!item) return null;

  const itemTypeBadge: Record<string, { label: string; color: string }> = {
    flashcard: { label: '🃏 Flashcard', color: '#5C6BC0' },
    multiple_choice: { label: '🎯 ECAES', color: '#00897B' },
    boolean: { label: '⚖️ V / F', color: '#F57C00' },
  };
  const badge = itemTypeBadge[item.item_type];

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.deckTitle} numberOfLines={1}>{activeDeck?.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={s.counter}>{itemIndex + 1}/{items.length}</Text>
          {activeDeck?.user_id === currentUserId && (
            <TouchableOpacity onPress={() => handleDeleteCard(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={18} color="#D32F2F" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${((itemIndex + 1) / items.length) * 100}%` as any }]} />
      </View>

      {/* Type badge */}
      <View style={[s.typeBadge, { backgroundColor: badge.color + '18' }]}>
        <Text style={[s.typeBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>

      {/* Question renderer */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <QuestionRendererFactory
          item={item}
          onAnswer={handleAnswer}
          onReveal={handleReveal}
          isAnswered={isAnswered}
          selectedRating={selectedRating}
          selectedIndex={selectedIndex}
          selectedBoolean={selectedBoolean}
        />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  deckTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text.primary, textAlign: 'center', paddingHorizontal: 8 },
  counter: { fontSize: 13, fontWeight: '600', color: theme.colors.text.secondary },
  progressBg: { height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 2 },
  typeBadge: { alignSelf: 'center', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14 },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
  // Session done
  sessionDone: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  doneEmoji: { fontSize: 52 },
  doneTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.text.primary, letterSpacing: -0.4 },
  doneSubtitle: { fontSize: 14, color: theme.colors.text.secondary, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statChip: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 80 },
  statChipNum: { fontSize: 22, fontWeight: '800' },
  statChipLabel: { fontSize: 11, fontWeight: '600' },
  backBtn: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, marginTop: 8 },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
