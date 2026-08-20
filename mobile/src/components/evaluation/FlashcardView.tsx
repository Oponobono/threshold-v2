/**
 * FlashcardView.tsx
 *
 * Flip animation — técnica de dos fases (industria: Quizlet, Duolingo):
 *
 *   Fase 1 (160ms): scaleX 1 → 0   la tarjeta "colapsa" horizontalmente
 *   Punto medio:    swap de contenido (invisible porque el card tiene 0px de ancho)
 *   Fase 2 (160ms): scaleX 0 → 1   la tarjeta "se expande" mostrando la nueva cara
 *
 * Ventajas vs. rotateY dual-view:
 *   — Un solo View → cero z-fighting, cero backface-visibility bugs de Android
 *   — Reanimated UI thread → cero jank, sin cruzar el bridge de JS
 *   — Sin overshoot → sin spring bounce, sin destellos
 *   — Funciona idéntico en iOS y Android
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { s } from '../../styles/FlashcardView.styles';
import { EvaluationItem, FlashcardContent } from '../../services/api/types';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

interface Props {
  item: EvaluationItem;
  onReveal: () => void;
  onAnswer: (rating: 'learning' | 'review') => void;
  onShowExplanation: () => void;
  onShowContext: () => void;
  isAnswered: boolean;
  selectedRating: 'learning' | 'review' | null;
  onNext?: () => void;
}

const HALF_DURATION = 160; // ms por cada mitad del flip

export const FlashcardView: React.FC<Props> = ({
  item, onReveal, onAnswer, onShowExplanation, onShowContext, isAnswered, selectedRating, onNext
}) => {
  const { t } = useTranslation();
  const content = item.content as FlashcardContent;

  const [showBack, setShowBack] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  // Shared values — corren en el UI thread, nunca tocan el bridge
  const scaleX = useSharedValue(1);
  const hintOpacity = useSharedValue(0);
  const hintTranslateY = useSharedValue(-8);

  // Reset completo al cambiar de tarjeta (nueva key desde QuestionRendererFactory)
  useEffect(() => {
    setShowBack(false);
    setHasRevealed(false);
    setHintVisible(false);
    setIsFlipping(false);
    scaleX.value = 1;
    hintOpacity.value = 0;
    hintTranslateY.value = -8;
  }, [item.id]);

  const onFlipDone = useCallback(() => {
    setIsFlipping(false);
  }, []);

  /**
   * onCollapseDone — corre en JS thread cuando scaleX llega a 0.
   *
   * 1. setState → React encola el re-render del nuevo contenido.
   * 2. requestAnimationFrame → espera a que React confirme el commit
   *    (el contenido ya está en los native views).
   * 3. Solo ENTONCES se inicia la expansión → scaleX 0 → 1.
   *
   * Esto garantiza que cuando la tarjeta se empiece a expandir,
   * el texto nuevo ya está renderizado. Cero lag perceptible.
   */
  const onCollapseDone = useCallback((toBack: boolean) => {
    // Paso 1: actualizar contenido
    setShowBack(toBack);
    if (toBack && !hasRevealed) {
      setHasRevealed(true);
      onReveal();
    }

    // Paso 2: esperar frame de React, luego expandir
    requestAnimationFrame(() => {
      scaleX.value = withTiming(1, {
        duration: HALF_DURATION,
        easing: Easing.out(Easing.quad),
      }, (finished) => {
        if (finished) runOnJS(onFlipDone)();
      });
    });
  }, [hasRevealed, onReveal, scaleX, onFlipDone]);

  const handleFlip = useCallback(() => {
    if (isFlipping) return;
    setIsFlipping(true);

    const toBack = !showBack;

    // Fase 1: colapso (scaleX 1 → 0)
    // Cuando llega a 0, le pasa el control al JS thread (onCollapseDone)
    // que esperará el render antes de iniciar la expansión.
    scaleX.value = withTiming(0, {
      duration: HALF_DURATION,
      easing: Easing.in(Easing.quad),
    }, (finished) => {
      if (!finished) {
        runOnJS(onFlipDone)();
        return;
      }
      runOnJS(onCollapseDone)(toBack);
    });
  }, [isFlipping, showBack, scaleX, onCollapseDone, onFlipDone]);

  const toggleHint = useCallback(() => {
    const next = !hintVisible;
    setHintVisible(next);
    hintOpacity.value = withTiming(next ? 1 : 0, { duration: 220 });
    hintTranslateY.value = withTiming(next ? 0 : -8, { duration: 220 });
  }, [hintVisible, hintOpacity, hintTranslateY]);

  // Estilos animados — UI thread only
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }],
  }));

  const hintAnimStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
    transform: [{ translateY: hintTranslateY.value }],
  }));

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={s.container} contentContainerStyle={s.scrollContent}>
      <View style={{ flexGrow: 1, justifyContent: 'flex-start' }}>

        {/* Hint banner */}
        {item.hint && hintVisible && (
          <Animated.View style={[s.hintBanner, hintAnimStyle]}>
            <Ionicons name="bulb" size={14} color="#FF9500" />
            <Text style={s.hintText}>{item.hint}</Text>
          </Animated.View>
        )}

        {/* Tarjeta única — sin superponer dos vistas */}
        <Animated.View style={[
          s.card,
          showBack ? s.cardBack : s.cardFront,
          cardAnimStyle,
          { marginBottom: 16 },
        ]}>
          {/* Label de cara */}
          <Text style={s.sideLabel}>
            {showBack ? t('flashcards.answer') : t('flashcards.question')}
          </Text>

          {/* Contenido */}
          <View style={s.cardContentWrapper}>
            <MarkdownWithCode>
              {showBack ? content.back : content.front}
            </MarkdownWithCode>
          </View>

          {/* Tap hint (cara frontal) */}
          {!showBack && (
            <View style={s.tapHint}>
              <Ionicons name="sync-outline" size={13} color={theme.colors.text.placeholder} />
              <Text style={s.tapHintText}>{t('flashcards.tapToFlip')}</Text>
            </View>
          )}

          {/* Área táctil de volteo — cubre toda la tarjeta */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleFlip}
            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
          />

          {/* Botón de pista (cara frontal) */}
          {item.hint && !isAnswered && !showBack && (
            <TouchableOpacity
              style={[s.hintBtn, hintVisible && s.hintBtnActive]}
              onPress={toggleHint}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Ionicons
                name={hintVisible ? 'bulb' : 'bulb-outline'}
                size={16}
                color={hintVisible ? '#FF9500' : theme.colors.text.placeholder}
              />
            </TouchableOpacity>
          )}

          {/* Botón de contexto */}
          {item.source_context && (
            <TouchableOpacity
              style={s.contextBtn}
              onPress={onShowContext}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Ionicons name="book-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          )}

          {/* Botón de explicación (solo cuando está respondida) */}
          {item.explanation && isAnswered && (
            <TouchableOpacity
              style={s.explanationBtn}
              onPress={onShowExplanation}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Ionicons name="help-circle-outline" size={16} color={theme.colors.info} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Rating buttons */}
        {hasRevealed && (
          <View style={s.ratingRow}>
            <TouchableOpacity
              style={[s.ratingBtn, s.ratingHard, selectedRating && selectedRating !== 'learning' && { opacity: 0.3 }]}
              onPress={() => onAnswer('learning')}
              disabled={isAnswered}
            >
              <Text style={s.ratingEmoji}>😓</Text>
              <Text style={[s.ratingLabel, { color: '#FF9800' }]}>{t('evaluation.hard')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ratingBtn, s.ratingEasy, selectedRating && selectedRating !== 'review' && { opacity: 0.3 }]}
              onPress={() => onAnswer('review')}
              disabled={isAnswered}
            >
              <Text style={s.ratingEmoji}>😊</Text>
              <Text style={[s.ratingLabel, { color: '#4CAF50' }]}>{t('evaluation.easy')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isAnswered && onNext && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 }}
            activeOpacity={0.6}
            onPress={onNext}
          >
            <Ionicons name="chevron-forward-outline" size={14} color={theme.colors.text.placeholder} />
            <Text style={{ fontSize: 12, color: theme.colors.text.placeholder }}>
              {t('flashcards.tapToContinue')}
            </Text>
          </TouchableOpacity>
        )}

      </View>
    </ScrollView>
  );
};
