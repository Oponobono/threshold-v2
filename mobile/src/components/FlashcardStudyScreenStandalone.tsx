/**
 * FlashcardStudyScreenStandalone.tsx
 * 
 * Versión para INTERFAZ MAZOS (con márgenes horizontales de 24)
 * Usado en: flashcards.tsx (pantalla dedicada)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { FlashcardDeck, EvaluationItem } from '../services/api/types';
import {
  StrategyFactory,
  adaptFlashcardsToEvaluationItems,
} from '../utils/evaluationStrategies';
import { updateFlashcardStatus, deleteFlashcard, analyzeDeckConfusions, generateDifferentiationCard, snoozeCard } from '../services/api';
import { recordCardReview } from '../services/api/analytics';
import { createCardLogWithFallback } from '../services/offlineQueue';
import { useCustomAlert } from './CustomAlert';
import { QuestionRendererFactory } from './evaluation/QuestionRendererFactory';
import { ExplanationOverlay } from './evaluation/ExplanationOverlay';
import { SnoozeModal } from './SnoozeModal';
import { useDueCardSnooze, SnoozeOption } from '../hooks/useDueCardSnooze';

interface Props {
  activeDeck: FlashcardDeck | null;
  initialCards: any[];
  currentUserId: number | null;
  onBack: () => void;
}

interface SessionStats {
  correct: number;
  incorrect: number;
  total: number;
}

const TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  flashcard:       { label: '🃏 Flashcard', color: '#5C6BC0', bg: '#EDE7F6' },
  multiple_choice: { label: '🎯 ECAES',     color: '#00897B', bg: '#E0F2F1' },
  boolean:         { label: '⚖️ V / F',     color: '#F57C00', bg: '#FFF3E0' },
};

export const FlashcardStudyScreenStandalone: React.FC<Props> = ({
  activeDeck, initialCards, currentUserId, onBack,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const { snoozeCard: snoozeCardLocal } = useDueCardSnooze();
  const insets = useSafeAreaInsets();
  const horizontalPadding = 24;

  const [items, setItems]               = useState<EvaluationItem[]>([]);
  const [itemIndex, setItemIndex]       = useState(0);
  const [sessionDone, setSessionDone]   = useState(false);
  const [stats, setStats]               = useState<SessionStats>({ correct: 0, incorrect: 0, total: 0 });
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());

  // Snooze Management
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [isSnoozing, setIsSnoozing] = useState(false);

  // Confusion Detection (Learning Engineering)
  const [confusionSuggestions, setConfusionSuggestions] = useState<any[]>([]);
  const [isAnalyzingConfusions, setIsAnalyzingConfusions] = useState(false);
  const [generatingDiff, setGeneratingDiff] = useState<string | null>(null); // stores conceptA key being generated

  // Estado por tipo de ítem
  const [isAnswered, setIsAnswered]           = useState(false);
  const [isRevealed, setIsRevealed]           = useState(false);
  const [selectedRating, setSelectedRating]   = useState<'learning' | 'review' | null>(null);
  const [selectedIndex, setSelectedIndex]     = useState<number | null>(null);
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null);

  // Overlay de explicación
  const [overlayVisible, setOverlayVisible]   = useState(false);
  const [isProcessing, setIsProcessing]       = useState(false); // Previene race conditions

  // Learning Engineering Feedback
  const [, setLearningFeedback] = useState<{ emoji: string, message: string, color?: string } | null>(null);

  const resetItemState = useCallback(() => {
    setIsAnswered(false);
    setIsRevealed(false);
    setSelectedRating(null);
    setSelectedIndex(null);
    setSelectedBoolean(null);
    setOverlayVisible(false);
    setIsProcessing(false);
  }, []);

  /**
   * Función para avanzar a la siguiente tarjeta.
   * Se llamará tanto desde el tap como desde el overlay dismiss.
   */
  const advanceToNextCard = useCallback(() => {
    const next = itemIndex + 1;
    if (next >= items.length) {
      setSessionDone(true);
    } else {
      setItemIndex(next);
      resetItemState();
      setCardStartTime(Date.now());
    }
  }, [itemIndex, items.length, resetItemState]);

  useEffect(() => {
    setItems(adaptFlashcardsToEvaluationItems(initialCards));
    resetItemState();
    setItemIndex(0);
    setSessionDone(false);
    setStats({ correct: 0, incorrect: 0, total: 0 });
    setCardStartTime(Date.now());
  }, [initialCards, resetItemState]);

  const handleReveal = useCallback(() => setIsRevealed(true), []);

  const handleShowExplanation = useCallback(() => setOverlayVisible(true), []);

  /** Cierra el overlay y ejecuta la función de avance */
  const handleOverlayDismiss = useCallback(() => {
    setOverlayVisible(false);
    // Pequeño delay para que la animación de cierre se vea antes de cambiar de ítem
    setTimeout(() => {
      advanceToNextCard();
    }, 180);
  }, [advanceToNextCard]);

  const handleAnswer = useCallback(async (answer: unknown) => {
    if (isAnswered || isProcessing) return; // Evita múltiples llamadas simultáneas

    const item = items[itemIndex];
    if (!item) return;

    const strategy = StrategyFactory.getStrategy(item.item_type);
    if (strategy.requiresReveal && !isRevealed) return;

    setIsProcessing(true); // Marcar inicio de procesamiento

    const responseTime = Date.now() - cardStartTime;
    const result  = strategy.evaluate(item, answer, responseTime);
    const newStatus = strategy.getStatusUpdate(result);

    // Actualizar UI inmediatamente
    setIsAnswered(true);
    if (item.item_type === 'flashcard')       setSelectedRating(answer as 'learning' | 'review');
    if (item.item_type === 'multiple_choice') setSelectedIndex(answer as number);
    if (item.item_type === 'boolean')         setSelectedBoolean(answer as boolean);

    // Stats
    setStats(prev => ({
      ...prev,
      correct:   prev.correct   + (result.passed ? 1 : 0),
      incorrect: prev.incorrect + (result.passed ? 0 : 1),
      total:     prev.total     + 1,
    }));

    // ── Enviar revisión al backend discretamente (FSRS) ──────────────────
    if (currentUserId && item.id) {
      try {
        console.log('[FlashcardReview] Enviando revisión:', {
          cardId: item.id,
          userId: currentUserId,
          result: result.passed ? 'correct' : 'incorrect',
          responseTimeMs: responseTime,
        });
        const reviewResult = await recordCardReview(
          item.id,
          currentUserId,
          result.passed ? 'correct' : 'incorrect',
          responseTime
        );
        console.log('[FlashcardReview] FSRS metrics:', {
          quality: reviewResult.quality,
          retention: reviewResult.retention,
          nextReview: reviewResult.nextReviewDate,
        });
      } catch (error) {
        console.warn('[FlashcardReview] Error sending review:', error);
        // No interrumpir la sesión si hay error
      }
    } else {
      console.log('[FlashcardReview] Omitiendo revisión - currentUserId:', currentUserId, 'item.id:', item.id);
    }

    // Persistir
    try {
      await updateFlashcardStatus(item.id, newStatus);
      
      const textToCount = item.front || (item as any).question || '';
      const wordCount = textToCount.trim() ? textToCount.trim().split(/\s+/).length : 20;

      const logResponse = await createCardLogWithFallback({ 
        card_id: item.id, 
        result: result.passed ? 'correct' : 'incorrect', 
        response_time_ms: responseTime,
        question_word_count: wordCount 
      });

      if (logResponse?.feedback) {
        setLearningFeedback({
          emoji: logResponse.feedback.emoji,
          message: logResponse.feedback.message,
          color: logResponse.microInteraction?.color || theme.colors.primary,
        });

        // Ocultar el feedback después de 2 segundos
        setTimeout(() => setLearningFeedback(null), 2000);
      }
    } catch {}

    setIsProcessing(false); // Marcar fin de procesamiento

  }, [isAnswered, isProcessing, isRevealed, items, itemIndex, cardStartTime, currentUserId]);

  const handleDeleteCard = (cardId: number) => {
    showAlert({
      title: t('flashcards.deleteItem', 'Eliminar ítem'),
      message: t('flashcards.deleteItemConfirm', '¿Estás seguro de que deseas eliminar este ítem de evaluación?'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: t('common.delete', 'Eliminar'), style: 'destructive',
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

  // ─── Snooze Card Handler ──────────────────────────────────────────────────────
  const handleSnoozeSelect = async (option: SnoozeOption) => {
    const currentItem = items[itemIndex];
    if (!currentItem) return;

    setIsSnoozing(true);
    try {
      // Enviar al backend
      await snoozeCard(currentItem.id, option.minutes, option.label);
      
      // Actualizar localmente con el hook
      snoozeCardLocal(String(currentItem.id), option.minutes);
      
      // Mostrar confirmación
      showAlert({
        title: t('flashcards.snoozed', '✅ Tarjeta aplazada'),
        message: t('flashcards.snoozeReappear', { label: option.label.toLowerCase(), defaultValue: `La revisión reaparecerá en ${option.label.toLowerCase()}` }),
        type: 'success',
        buttons: [
          {
            text: t('flashcards.continueBtn', 'Continuar'),
            onPress: () => {
              setShowSnoozeModal(false);
              // Avanzar a la siguiente tarjeta
              const next = itemIndex + 1;
              if (next >= items.length) {
                setSessionDone(true);
              } else {
                setItemIndex(next);
                resetItemState();
                setCardStartTime(Date.now());
              }
            },
          },
        ],
      });
    } catch (error: any) {
      showAlert({
        title: t('flashcards.snoozeError', 'Error al aplazar'),
        message: error.message || t('flashcards.snoozeErrorMsg', 'No se pudo aplazar la tarjeta'),
        type: 'error',
      });
    } finally {
      setIsSnoozing(false);
    }
  };

  // ─── Session Done: trigger confusion analysis once ──────────────────────────
  useEffect(() => {
    if (!sessionDone || !activeDeck?.id || isAnalyzingConfusions) return;
    setIsAnalyzingConfusions(true);
    
    // Garantizar mínimo 2.5 segundos de visualización del banner
    const minTimerPromise = new Promise<void>(resolve => {
      setTimeout(() => resolve(), 2500);
    });
    
    Promise.all([
      analyzeDeckConfusions(activeDeck.id).catch(() => null),
      minTimerPromise
    ])
      .then(([result]) => setConfusionSuggestions(result?.suggestions ?? []))
      .finally(() => setIsAnalyzingConfusions(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDone]);

  const handleGenerateDiff = async (suggestion: any) => {
    if (!activeDeck?.id) return;
    const key = suggestion.conceptA;
    setGeneratingDiff(key);
    try {
      await generateDifferentiationCard(activeDeck.id, suggestion.conceptA, suggestion.conceptB, suggestion.reason);
      // Remove suggestion once card is created
      setConfusionSuggestions(prev => prev.filter(s => s.conceptA !== key));
      showAlert({ title: t('flashcards.cardCreated', '✅ Tarjeta creada'), message: t('flashcards.cardCreatedMsg', { conceptA: suggestion.conceptA, conceptB: suggestion.conceptB, defaultValue: `Se añadió una tarjeta de contraste entre "${suggestion.conceptA}" y "${suggestion.conceptB}" a tu mazo.` }), type: 'success' });
    } catch (e: any) {
      showAlert({ title: t('common.error', 'Error'), message: e.message || t('flashcards.cardCreateError', 'No se pudo generar la tarjeta'), type: 'error' });
    } finally {
      setGeneratingDiff(null);
    }
  };

  // ─── Session Done ──────────────────────────────────────────────────────────
  if (sessionDone) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <ScrollView
        contentContainerStyle={[s.sessionDone, { flexGrow: 1, paddingHorizontal: horizontalPadding, paddingLeft: Math.max(insets.left, horizontalPadding), paddingRight: Math.max(insets.right, horizontalPadding), paddingBottom: Math.max(insets.bottom, 32) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.doneEmoji}>{pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</Text>
        <Text style={s.doneTitle}>{t('flashcards.sessionCompleted', '¡Sesión completada!')}</Text>
        <Text style={s.doneSubtitle}>{t('flashcards.itemsReviewed', { count: items.length, plural: items.length !== 1 ? 's' : '', defaultValue: `${items.length} ítem${items.length !== 1 ? 's' : ''} revisados` })}</Text>
        {stats.total > 0 && (
          <View style={s.statsRow}>
            <View style={[s.statChip, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[s.statChipNum, { color: '#2E7D32' }]}>{stats.correct}</Text>
              <Text style={[s.statChipLabel, { color: '#2E7D32' }]}>{t('flashcards.statCorrect', 'Correctas')}</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: '#FFEBEE' }]}>
              <Text style={[s.statChipNum, { color: '#C62828' }]}>{stats.incorrect}</Text>
              <Text style={[s.statChipLabel, { color: '#C62828' }]}>{t('flashcards.statIncorrect', 'Incorrectas')}</Text>
            </View>
            <View style={[s.statChip, { backgroundColor: '#F3E5F5' }]}>
              <Text style={[s.statChipNum, { color: '#6A1B9A' }]}>{pct}%</Text>
              <Text style={[s.statChipLabel, { color: '#6A1B9A' }]}>{t('flashcards.statAccuracy', 'Acierto')}</Text>
            </View>
          </View>
        )}

        {/* ── Confusion Detection Panel ── */}
        {isAnalyzingConfusions && (
          <View style={confusionStyles.banner}>
            <Text style={confusionStyles.bannerTitle}>{t('flashcards.analyzingDeck', '🧠 Analizando tu mazo...')}</Text>
            <Text style={confusionStyles.bannerSubtitle}>{t('flashcards.searchingConfusions', 'Buscando conceptos que podrías confundir.')}</Text>
          </View>
        )}
        {!isAnalyzingConfusions && confusionSuggestions.length > 0 && (
          <View style={confusionStyles.banner}>
            <Text style={confusionStyles.bannerTitle}>{t('flashcards.confusionTitle', '⚠️ Conceptos Confundibles Detectados')}</Text>
            <Text style={confusionStyles.bannerSubtitle}>{t('flashcards.confusionSubtitle', { count: confusionSuggestions.length, plural: confusionSuggestions.length > 1 ? 'es' : '', defaultValue: `El análisis encontró ${confusionSuggestions.length} par${confusionSuggestions.length > 1 ? 'es' : ''} que suelen confundirse. Genera una tarjeta de contraste para fijar la diferencia.` })}</Text>
            {confusionSuggestions.map((s, i) => (
              <View key={i} style={confusionStyles.suggestionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={confusionStyles.suggestionConcepts} numberOfLines={1}>
                    {s.conceptA} <Text style={{ color: '#9E9E9E' }}>vs</Text> {s.conceptB}
                  </Text>
                  <Text style={confusionStyles.suggestionReason} numberOfLines={2}>{s.reason}</Text>
                </View>
                <TouchableOpacity
                  style={[confusionStyles.generateBtn, generatingDiff === s.conceptA && { opacity: 0.5 }]}
                  onPress={() => handleGenerateDiff(s)}
                  disabled={generatingDiff !== null}
                >
                  <Text style={confusionStyles.generateBtnText}>
                    {generatingDiff === s.conceptA ? '...' : t('flashcards.differentiateBtn', '+ Diferenciar')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={s.backBtn} onPress={onBack}>
          <Text style={s.backBtnText}>{t('flashcards.backToDecks', 'Volver a mazos')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const item = items[itemIndex];
  if (!item) return null;

  const badge = TYPE_BADGE[item.item_type] ?? TYPE_BADGE.flashcard;

  return (
    <View style={[{ flex: 1, paddingHorizontal: horizontalPadding, paddingLeft: Math.max(insets.left, horizontalPadding), paddingRight: Math.max(insets.right, horizontalPadding), paddingTop: insets.top, marginTop: 8, paddingBottom: Math.max(insets.bottom + 12, 20) }]}>

      {/* ── Header: flecha  |  título (badge inline)  |  snooze + contador + trash ── */}
      <View style={[s.header, { marginBottom: 6 }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>

        {/* Título + badge en la misma línea */}
        <View style={s.titleBlock}>
          <Text style={s.deckTitle} numberOfLines={1}>{activeDeck?.title}</Text>
          <View style={[s.inlineBadge, { backgroundColor: badge.bg }]}>
            <Text style={[s.inlineBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={s.headerRight}>
          {/* Botón Snooze (disponible durante la sesión) */}
          <TouchableOpacity 
            onPress={() => setShowSnoozeModal(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={isAnswered && !overlayVisible}
          >
            <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          
          <Text style={s.counter}>{itemIndex + 1}/{items.length}</Text>
          {activeDeck?.user_id === currentUserId && (
            <TouchableOpacity onPress={() => handleDeleteCard(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={18} color="#D32F2F" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${((itemIndex + 1) / items.length) * 100}%` as any }]} />
      </View>

      {/* ── Question renderer (sin ScrollView envolvente: cada vista gestiona su scroll) ── */}
      <TouchableOpacity 
        style={{ flex: 1, marginTop: 10 }}
        onPress={() => {
          // Solo avanza si: respondió + no está procesando + overlay no visible
          if (isAnswered && !isProcessing && !overlayVisible) {
            advanceToNextCard();
          }
        }}
        activeOpacity={1}
      >
        <QuestionRendererFactory
          item={item}
          onAnswer={handleAnswer}
          onReveal={handleReveal}
          onShowExplanation={handleShowExplanation}
          isAnswered={isAnswered}
          selectedRating={selectedRating}
          selectedIndex={selectedIndex}
          selectedBoolean={selectedBoolean}
        />
      </TouchableOpacity>

      {/* ── Overlay flotante de explicación ── */}
      <ExplanationOverlay
        visible={overlayVisible}
        explanation={item.explanation ?? null}
        onDismiss={handleOverlayDismiss}
      />

      {/* ── Modal de Snooze ── */}
      <SnoozeModal
        visible={showSnoozeModal}
        onClose={() => setShowSnoozeModal(false)}
        onSelect={handleSnoozeSelect}
        isLoading={isSnoozing}
      />

      {/* ── Micro-Interacción / Feedback de Learning Engineering (Interno - no mostrar en UI) ── */}
      {/* Comentado: El feedback se recopila pero no se muestra visualmente
      {learningFeedback && (
        <View style={[s.feedbackToast, { borderColor: learningFeedback.color }]}>
          <Text style={s.feedbackEmoji}>{learningFeedback.emoji}</Text>
          <Text style={s.feedbackMessage}>{learningFeedback.message}</Text>
        </View>
      )}
      */}
    </View>
  );
};

const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  deckTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
    maxWidth: '65%',
  },
  inlineBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  inlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counter: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  // Progress
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
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
  // Feedback Toast
  feedbackToast: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 8,
  },
  feedbackEmoji: { fontSize: 20 },
  feedbackMessage: { fontSize: 14, fontWeight: '600', color: '#333' },
});

const confusionStyles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: '#FFFBF0',
    borderWidth: 1.5,
    borderColor: '#FFB300',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    gap: 6,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#795548',
    lineHeight: 17,
    marginBottom: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  suggestionConcepts: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2F00',
    marginBottom: 2,
  },
  suggestionReason: {
    fontSize: 11,
    color: '#795548',
    lineHeight: 15,
  },
  generateBtn: {
    backgroundColor: '#FF8F00',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});
