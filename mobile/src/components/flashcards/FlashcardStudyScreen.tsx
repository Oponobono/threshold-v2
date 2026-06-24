/**
 * FlashcardStudyScreen.tsx
 * 
 * Versión para MODAL (sin márgenes horizontales significativos)
 * Usado en: FlashcardsModal (index)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { FlashcardDeck, EvaluationItem } from '../../services/api/types';
import {
  StrategyFactory,
  adaptFlashcardsToEvaluationItems,
} from '../../utils/evaluationStrategies';
import { updateFlashcardStatus, deleteFlashcard, snoozeCard, createCardLog } from '../../services/api';
import { analyzeDeckConfusionsHybrid as analyzeDeckConfusions, generateDifferentiationCardHybrid as generateDifferentiationCard } from '../../services/hybridAIService';
import { recordCardReview } from '../../services/api/analytics';
import { ExamSchedulerService } from '../../services/ExamSchedulerService';
import { useCustomAlert } from '../ui/CustomAlert';
import { QuestionRendererFactory } from '../evaluation/QuestionRendererFactory';
import { ExplanationOverlay } from '../evaluation/ExplanationOverlay';
import { SnoozeModal } from '../modals/SnoozeModal';
import { useDueCardSnooze, SnoozeOption } from '../../hooks/useDueCardSnooze';
import { ContextBottomSheet } from '../evaluation/ContextBottomSheet';

interface Props {
  activeDeck: FlashcardDeck | null;
  initialCards: any[];
  currentUserId: string | null;
  onBack: () => void;
}

interface SessionStats {
  correct: number;
  incorrect: number;
  total: number;
}

const TYPE_BADGE: Record<string, { labelKey: string; color: string; bg: string }> = {
  flashcard:       { labelKey: 'flashcards.typeFlashcard', color: '#5C6BC0', bg: '#EDE7F6' },
  multiple_choice: { labelKey: 'flashcards.typeECAES',     color: '#00897B', bg: '#E0F2F1' },
  boolean:         { labelKey: 'flashcards.typeBoolean',   color: '#F57C00', bg: '#FFF3E0' },
};

export const FlashcardStudyScreen: React.FC<Props> = ({
  activeDeck, initialCards, currentUserId, onBack,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const { snoozeCard: snoozeCardLocal } = useDueCardSnooze();
  const insets = useSafeAreaInsets();
  const horizontalPadding = 0;

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
  const [needsLocalModel, setNeedsLocalModel] = useState(false);

  // Exam Mode
  const [examMultiplier, setExamMultiplier] = useState<number>(1.0);

  // Estado por tipo de ítem
  const [isAnswered, setIsAnswered]           = useState(false);
  const [isRevealed, setIsRevealed]           = useState(false);
  const [selectedRating, setSelectedRating]   = useState<'learning' | 'review' | null>(null);
  const [selectedIndex, setSelectedIndex]     = useState<number | null>(null);
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null);

  // Overlay de explicación
  const [overlayVisible, setOverlayVisible]   = useState(false);
  const [contextVisible, setContextVisible]   = useState(false);
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
    setContextVisible(false);
    setIsProcessing(false);
  }, []);

  /**
   * Función para avanzar a la siguiente tarjeta.
   * Se llamará tanto desde el tap como desde el overlay dismiss.
   */
  const isAdvancingRef = useRef(false);

  const advanceToNextCard = useCallback(() => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    const next = itemIndex + 1;
    if (next >= items.length) {
      setSessionDone(true);
    } else {
      setItemIndex(next);
      resetItemState();
      setCardStartTime(Date.now());
    }

    setTimeout(() => {
      isAdvancingRef.current = false;
    }, 400);
  }, [itemIndex, items.length, resetItemState]);

  useEffect(() => {
    const sortByExam = async () => {
      const sid = activeDeck?.subject_id ?? null;
      const multiplier = await ExamSchedulerService.getCompressionMultiplier(sid);
      setExamMultiplier(multiplier);
      const now = Date.now();
      const sorted = [...initialCards].sort((a, b) => {
        const nrdA = a.next_review_date ? new Date(a.next_review_date).getTime() : 0;
        const nrdB = b.next_review_date ? new Date(b.next_review_date).getTime() : 0;
        const effectiveA = nrdA ? now + (nrdA - now) * multiplier : Infinity;
        const effectiveB = nrdB ? now + (nrdB - now) * multiplier : Infinity;
        return effectiveA - effectiveB;
      });
      setItems(adaptFlashcardsToEvaluationItems(sorted));
    };
    sortByExam();
    resetItemState();
    setItemIndex(0);
    setSessionDone(false);
    setStats({ correct: 0, incorrect: 0, total: 0 });
    setCardStartTime(Date.now());
    setNeedsLocalModel(false);
  }, [initialCards, resetItemState, activeDeck?.subject_id]);

  const handleReveal = useCallback(() => setIsRevealed(true), []);

  const handleShowExplanation = useCallback(() => {
    setContextVisible(false); // Oculta contexto si se abre explicación
    setOverlayVisible(true);
  }, []);

  const handleShowContext = useCallback(() => {
    setOverlayVisible(false); // Oculta explicación si se abre contexto
    setContextVisible(true);
  }, []);

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
          String(item.id),
          String(currentUserId),
          result.passed ? 'correct' : 'incorrect',
          responseTime,
          activeDeck?.subject_id,
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
    const isLocalCard = typeof item.id === 'number' && item.id < 0;

    try {
      const textToCount = item.front || (item as any).question || '';
      const wordCount = textToCount.trim() ? textToCount.trim().split(/\s+/).length : 20;

      const logResponse = await createCardLog({ 
        card_id: item.id, 
        result: result.passed ? 'correct' : 'incorrect', 
        response_time_ms: responseTime,
        question_word_count: wordCount 
      }).catch(() => ({ queued: true, card_id: item.id }));

      if (logResponse?.feedback) {
        setLearningFeedback({
          emoji: logResponse.feedback.emoji,
          message: logResponse.feedback.message,
          color: logResponse.microInteraction?.color || theme.colors.primary,
        });

        setTimeout(() => setLearningFeedback(null), 2000);
      }
    } catch {}

    // Actualizar estado y contadores según tipo de tarjeta
    if (activeDeck?.id) {
      if (isLocalCard) {
        const { updateLocalCard, recalculateLocalDeckCounters } = await import('../../services/localFlashcardService');
        await updateLocalCard(Number(activeDeck.id), Number(item.id), {}, newStatus);
        await recalculateLocalDeckCounters(Number(activeDeck.id));
      } else {
        // Cloud: persistir status en SQLite + backend
        try {
          await updateFlashcardStatus(item.id, newStatus);
        } catch {}

        try {
          const { databaseService } = await import('../../services/database/DatabaseService');
          const db = databaseService.getDb();
          const row: any = await db.getFirstAsync(
            `SELECT
              COUNT(CASE WHEN status = 'review' THEN 1 END) as review_count,
              COUNT(CASE WHEN status = 'learning' THEN 1 END) as learning_count,
              COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count
            FROM flashcards WHERE deck_id = ?`,
            String(activeDeck.id)
          );
          if (row) {
            await db.runAsync(
              `UPDATE flashcard_decks SET review_count = ?, learning_count = ?, new_count = ?, updated_at = datetime('now') WHERE id = ?`,
              row.review_count, row.learning_count, row.new_count, String(activeDeck.id)
            );
          }
        } catch {}
      }
    }

    // Refresh predictions after reviewing
    try {
      const { useDataStore } = await import('../../store/useDataStore');
      if (currentUserId) {
        useDataStore.getState().refreshPredictions(currentUserId);
      }
    } catch {}

    setIsProcessing(false);

  }, [isAnswered, isProcessing, isRevealed, items, itemIndex, cardStartTime, currentUserId]);

  const handleDeleteCard = (cardId: string) => {
    showAlert({
      title: t('flashcards.deleteItem'),
      message: t('flashcards.deleteItemConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
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
        title: t('flashcards.snoozed'),
        message: t('flashcards.snoozeReappear', { label: option.label.toLowerCase() }),
        type: 'success',
        buttons: [
          {
            text: t('flashcards.continueBtn'),
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
        title: t('flashcards.snoozeError'),
        message: error.message || t('flashcards.snoozeErrorMsg'),
        type: 'error',
      });
    } finally {
      setIsSnoozing(false);
    }
  };

  // ─── Session Done: trigger confusion analysis once ──────────────────────────
  useEffect(() => {
    if (!sessionDone || !activeDeck?.id || isAnalyzingConfusions) return;
    console.log('[SessionDone] Iniciando análisis para mazo:', activeDeck.id);
    setIsAnalyzingConfusions(true);
    setNeedsLocalModel(false);
    setConfusionSuggestions([]);
    
    // Garantizar mínimo 2.5 segundos de visualización del banner
    const minTimerPromise = new Promise<void>(resolve => {
      setTimeout(() => resolve(), 2500);
    });
    
    Promise.all([
      (async () => {
        try {
          const result = await analyzeDeckConfusions(activeDeck.id);
          console.log('[SessionDone] Análisis completado:', result?.suggestions?.length ?? 0, 'sugerencias');
          return result;
        } catch (e: any) {
          console.warn('[SessionDone] Error en análisis:', e?.message);
          if (e?.message?.includes('Anclas cognitivas') || e?.message?.includes('modelo local') || e?.message?.includes('Groq')) {
            setNeedsLocalModel(true);
          }
          return null;
        }
      })(),
      minTimerPromise
    ])
      .then(([result]) => {
        if (result) {
          setConfusionSuggestions(result.suggestions ?? []);
        }
      })
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
      showAlert({ title: t('flashcards.cardCreated'), message: t('flashcards.cardCreatedMsg', { conceptA: suggestion.conceptA, conceptB: suggestion.conceptB }), type: 'success' });
    } catch (e: any) {
      showAlert({ title: t('common.error'), message: e.message || t('flashcards.cardCreateError'), type: 'error' });
    } finally {
      setGeneratingDiff(null);
    }
  };

  // ─── Session Done ──────────────────────────────────────────────────────────
  if (sessionDone) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    return (
      <View style={{ flex: 1, width: '100%' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.sessionDone, { paddingHorizontal: horizontalPadding, paddingLeft: Math.max(insets.left, horizontalPadding), paddingRight: Math.max(insets.right, horizontalPadding), paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.doneEmoji}>{pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</Text>
          <Text style={s.doneTitle}>{t('flashcards.sessionCompleted')}</Text>
          <Text style={s.doneSubtitle}>{t('flashcards.itemsReviewed', { count: items.length, plural: items.length !== 1 ? 's' : '' })}</Text>
          {stats.total > 0 && (
            <View style={s.statsRow}>
              <View style={[s.statChip, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[s.statChipNum, { color: '#2E7D32' }]}>{stats.correct}</Text>
                <Text style={[s.statChipLabel, { color: '#2E7D32' }]}>{t('flashcards.statCorrect')}</Text>
              </View>
              <View style={[s.statChip, { backgroundColor: '#FFEBEE' }]}>
                <Text style={[s.statChipNum, { color: '#C62828' }]}>{stats.incorrect}</Text>
                <Text style={[s.statChipLabel, { color: '#C62828' }]}>{t('flashcards.statIncorrect')}</Text>
              </View>
              <View style={[s.statChip, { backgroundColor: '#F3E5F5' }]}>
                <Text style={[s.statChipNum, { color: '#6A1B9A' }]}>{pct}%</Text>
                <Text style={[s.statChipLabel, { color: '#6A1B9A' }]}>{t('flashcards.statAccuracy')}</Text>
              </View>
            </View>
          )}

          {/* ── Confusion Detection Panel ── */}
          {isAnalyzingConfusions && (
            <View style={confusionStyles.banner}>
              <Text style={confusionStyles.bannerTitle}>{t('flashcards.analyzingDeck')}</Text>
              <Text style={confusionStyles.bannerSubtitle}>{t('flashcards.searchingConfusions')}</Text>
            </View>
          )}
          {!isAnalyzingConfusions && needsLocalModel && (
            <View style={confusionStyles.banner}>
              <Text style={confusionStyles.bannerTitle}>{t('flashcards.anclaTitle')}</Text>
              <Text style={confusionStyles.bannerSubtitle}>{t('flashcards.noLocalModel')}</Text>
            </View>
          )}
          {!isAnalyzingConfusions && !needsLocalModel && confusionSuggestions.length > 0 && (
            <View style={confusionStyles.banner}>
              <Text style={confusionStyles.bannerTitle}>{t('flashcards.confusionTitle')}</Text>
              <Text style={confusionStyles.bannerSubtitle}>{t('flashcards.confusionSubtitle', { count: confusionSuggestions.length, plural: confusionSuggestions.length > 1 ? 'es' : '' })}</Text>
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
                      {generatingDiff === s.conceptA ? '...' : t('flashcards.differentiateBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        
        {/* Botón anclado justo encima de la barra nativa del móvil */}
        <View style={{ paddingHorizontal: Math.max(insets.left, horizontalPadding, 20), paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
          <TouchableOpacity style={s.backBtn} onPress={onBack}>
            <Text style={s.backBtnText}>{t('flashcards.backToDecks')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const item = items[itemIndex];
  if (!item) return null;

  const badge = TYPE_BADGE[item.item_type] ?? TYPE_BADGE.flashcard;

  return (
    <View style={[{ flex: 1 }, { paddingHorizontal: horizontalPadding, paddingLeft: Math.max(insets.left, horizontalPadding), paddingRight: Math.max(insets.right, horizontalPadding), paddingBottom: 0 }]}>

      {/* ── Header Dividido en dos líneas ── */}
      <View style={{ marginBottom: 16, marginTop: 6, gap: 12 }}>
        {/* Fila 1: Flecha + Nombre del Mazo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={[s.deckTitle, { flex: 1, maxWidth: '100%' }]} numberOfLines={1}>
            {activeDeck?.title}
          </Text>
        </View>

        {/* Fila 2: Badge del Tipo de Tarjeta + Botones y Contador */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={[s.inlineBadge, { backgroundColor: badge.bg }]}>
            <Text style={[s.inlineBadgeText, { color: badge.color }]}>{t(badge.labelKey)}</Text>
          </View>

          <View style={s.headerRight}>
            <TouchableOpacity 
              onPress={() => setShowSnoozeModal(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              disabled={isAnswered && !overlayVisible}
            >
              <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
            
            <Text style={s.counter}>{itemIndex + 1}/{items.length}</Text>
            
            {activeDeck?.user_id === currentUserId && (
              <TouchableOpacity onPress={() => handleDeleteCard(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={20} color="#D32F2F" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── Exam Mode Banner ── */}
      {examMultiplier < 1.0 && (
        <View style={examBannerStyle}>
          <Ionicons name="alarm-outline" size={14} color="#E65100" />
          <Text style={examBannerText}>
            Modo Examen · Intervalos al {Math.round(examMultiplier * 100)}%
          </Text>
        </View>
      )}

      {/* ── Progress bar ── */}
      <View style={[s.progressBg, { marginHorizontal: -horizontalPadding, marginLeft: -Math.max(insets.left, horizontalPadding), marginRight: -Math.max(insets.right, horizontalPadding) }]}>
        <View style={[s.progressFill, { width: `${((itemIndex + 1) / items.length) * 100}%` as any }]} />
      </View>

      {/* ── Question renderer (cada vista gestiona su scroll y touch para avanzar) ── */}
      <View style={{ flex: 1, marginHorizontal: -8, marginLeft: -Math.max(insets.left, 8), marginRight: -Math.max(insets.right, 8) }}>
        <QuestionRendererFactory
          item={item}
          onAnswer={handleAnswer}
          onReveal={handleReveal}
          onShowExplanation={handleShowExplanation}
          onShowContext={handleShowContext}
          isAnswered={isAnswered}
          selectedRating={selectedRating}
          selectedIndex={selectedIndex}
          selectedBoolean={selectedBoolean}
          onNext={advanceToNextCard}
        />
      </View>

      {/* ── Overlay flotante de explicación ── */}
      <ExplanationOverlay
        visible={overlayVisible}
        explanation={item.explanation ?? null}
        onDismiss={handleOverlayDismiss}
      />

      {/* ── Bottom Sheet de Contexto ── */}
      <ContextBottomSheet
        visible={contextVisible}
        contextJson={item.source_context ?? null}
        onDismiss={() => setContextVisible(false)}
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

// ── Exam Mode Banner inline styles (defined outside StyleSheet for reuse in JSX) ──
const examBannerStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 6,
  backgroundColor: '#FFF3E0',
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: '#FFB74D',
};

const examBannerText = {
  fontSize: 12,
  fontWeight: '700' as const,
  color: '#E65100',
};
