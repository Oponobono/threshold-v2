/**
 * FlashcardStudyScreenStandalone.tsx
 * 
 * Versión para INTERFAZ MAZOS (con márgenes horizontales de 24)
 * Usado en: flashcards.tsx (pantalla dedicada)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { s, confusionStyles } from '../../styles/FlashcardStudyScreenStandalone.styles';
import { FlashcardDeck, EvaluationItem } from '../../services/api/types';
import {
  StrategyFactory,
  adaptFlashcardsToEvaluationItems,
} from '../../utils/evaluationStrategies';
import { updateFlashcardStatus, deleteFlashcard, snoozeCard } from '../../services/api';
import { analyzeDeckConfusionsHybrid as analyzeDeckConfusions, generateDifferentiationCardHybrid as generateDifferentiationCard } from '../../services/hybridAIService';
import { FlashcardDomainService } from '../../domain/fsrs/FlashcardDomainService';
import { ExamSchedulerService } from '../../services/ExamSchedulerService';
import { useCustomAlert } from '../ui/CustomAlert';
import { QuestionRendererFactory } from '../evaluation/QuestionRendererFactory';
import { ExplanationOverlay } from '../evaluation/ExplanationOverlay';
import { ContextBottomSheet } from '../evaluation/ContextBottomSheet';
import { SnoozeModal } from '../modals/SnoozeModal';
import { useDueCardSnooze, SnoozeOption } from '../../hooks/useDueCardSnooze';

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
  const [needsLocalModel, setNeedsLocalModel] = useState(false);

  // Estado por tipo de ítem
  const [isAnswered, setIsAnswered]           = useState(false);
  const [isRevealed, setIsRevealed]           = useState(false);
  const [selectedRating, setSelectedRating]   = useState<'learning' | 'review' | null>(null);
  const [selectedIndex, setSelectedIndex]     = useState<number | null>(null);
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null);

  // Overlay de explicación y contexto
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
      const did = activeDeck?.id ?? null;
      const multiplier = await ExamSchedulerService.getCompressionMultiplier(did);
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
    setContextVisible(false);
    setOverlayVisible(true);
  }, []);

  const handleShowContext = useCallback(() => {
    setOverlayVisible(false);
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

    // ── Local-First Domain Execution ──────────────────────────────────────
    if (currentUserId && item.id) {
      try {
        await FlashcardDomainService.recordReview(item as any, result.passed, responseTime);
      } catch (error) {
        console.warn('[FlashcardReview] Error in Domain Service:', error);
      }
    }

    const isLocalCard = (item as any)._local === true;

    if (activeDeck?.id) {
      if (isLocalCard) {
        const { updateLocalCard, recalculateLocalDeckCounters } = await import('../../services/localFlashcardService');
        await updateLocalCard(activeDeck.id, String(item.id), {}, newStatus);
        await recalculateLocalDeckCounters(activeDeck.id);
      } else {
        try {
          const { databaseService } = await import('../../services/database/DatabaseService');
          const db = databaseService.getDb();
          const row: any = await db.getFirstAsync(
            `SELECT
              COUNT(CASE WHEN status = 'review' THEN 1 END) as review_count,
              COUNT(CASE WHEN status = 'learning' THEN 1 END) as learning_count,
              COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count
            FROM flashcards WHERE deck_id = ? AND deleted_at IS NULL`,
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

    try {
      const { useDataStore } = await import('../../store/useDataStore');
      if (currentUserId) useDataStore.getState().refreshPredictions(currentUserId);
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
      .finally(() => {
        setIsAnalyzingConfusions(false);
        try {
          const { getReminderCoordinator } = require('../../services/reminders/reminderCoordinatorInstance');
          getReminderCoordinator().handleActionCompleted('flashcard_deck', activeDeck.id);
        } catch {}
      });
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
    <View style={[{ flex: 1, paddingHorizontal: horizontalPadding, paddingLeft: Math.max(insets.left, horizontalPadding), paddingRight: Math.max(insets.right, horizontalPadding), paddingTop: insets.top, marginTop: 8, paddingBottom: 0 }]}>

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

      {/* ── Progress bar ── */}
      <View style={s.progressBg}>
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
