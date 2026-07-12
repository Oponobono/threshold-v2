import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView
} from 'react-native';
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

export const FlashcardView: React.FC<Props> = ({
  item, onReveal, onAnswer, onShowExplanation, onShowContext, isAnswered, selectedRating, onNext
}) => {
  const { t } = useTranslation();
  const content = item.content as FlashcardContent;
  const [isFlipped, setIsFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const [activeFace, setActiveFace] = useState<'front' | 'back'>('front');
  const [hasRevealed, setHasRevealed] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
    setHasRevealed(false);
    setActiveFace('front');
    setHintVisible(false);
    flipAnim.setValue(0);
    hintAnim.setValue(0);
  }, [item.id, flipAnim, hintAnim]);

  const handleFlip = () => {
    if (!isFlipped) {
      setActiveFace('back');
      Animated.spring(flipAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start(() => {
        setIsFlipped(true);
        if (!hasRevealed) { setHasRevealed(true); onReveal(); }
      });
    } else {
      setActiveFace('front');
      Animated.spring(flipAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start(() => {
        setIsFlipped(false);
      });
    }
  };

  const toggleHint = () => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] });
  const cardScale    = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1] });

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={s.container} contentContainerStyle={s.scrollContent}>
      <View style={{ flexGrow: 1, justifyContent: 'flex-start' }}>

        {/* Hint banner */}
        {item.hint && hintVisible && (
          <Animated.View style={[s.hintBanner, {
            opacity: hintAnim,
            transform: [{ translateY: hintAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          }]}>
            <Ionicons name="bulb" size={14} color="#FF9500" />
            <Text style={s.hintText}>{item.hint}</Text>
          </Animated.View>
        )}

        {/*
         * flipWrapper es el contenedor relativo donde viven las dos caras
         * y los botones flotantes.
         *
         * REGLA ANDROID: el ÚLTIMO elemento renderizado dentro de un View
         * recibe el toque primero si sus áreas se superponen.
         *
         * Orden:
         *  1. Cara frontal (Animated.View + absoluteFill TO adentro)
         *  2. Cara trasera (Animated.View + absoluteFill TO adentro)
         *  3. Botón pista  ← ÚLTIMO → siempre gana en su área
         *  4. Botón explicación ← ÚLTIMO → siempre gana en su área
         *
         * REGLA OPACIDAD: opacity:0 en React Native NO desactiva los toques.
         * Por eso usamos pointerEvents="none" en la cara oculta.
         */}
        <View style={s.flipWrapper}>

          <Animated.View
            style={[
              s.card, s.cardFront,
              activeFace === 'front' ? s.relativeCard : s.absoluteCard,
              { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotate }, { scale: cardScale }] },
            ]}
            pointerEvents={activeFace === 'front' ? 'auto' : 'none'}
          >
            <Text style={s.sideLabel}>{t('flashcards.question')}</Text>
            <View style={s.cardContentWrapper}>
              <MarkdownWithCode>{content.front}</MarkdownWithCode>
            </View>
            <View style={s.tapHint}>
              <Ionicons name="sync-outline" size={13} color={theme.colors.text.placeholder} />
              <Text style={s.tapHintText}>{t('flashcards.tapToFlip')}</Text>
            </View>
            {/* TO para voltear ocupa toda la cara (renderizado al final de la tarjeta) */}
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleFlip}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
          </Animated.View>

          {/* ── CARA TRASERA ── */}
          <Animated.View
            style={[
              s.card, s.cardBack,
              activeFace === 'back' ? s.relativeCard : s.absoluteCard,
              { opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotate }, { scale: cardScale }] },
            ]}
            pointerEvents={activeFace === 'back' ? 'auto' : 'none'}
          >
            <Text style={s.sideLabel}>{t('flashcards.answer')}</Text>
            <View style={s.cardContentWrapper}>
              <MarkdownWithCode>{content.back}</MarkdownWithCode>
            </View>
            {/* TO para voltear ocupa toda la cara trasera (renderizado al final de la tarjeta) */}
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleFlip}
              style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
            />
          </Animated.View>

          {/*
           * ── BOTONES FLOTANTES ──
           * Renderizados DESPUÉS de ambas caras → máxima prioridad táctil en Android.
           * position:'absolute' los ancla a flipWrapper sin ocupar espacio en el flujo.
           */}

          {item.hint && !isAnswered && activeFace === 'front' && (
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

          {item.source_context && (
            <TouchableOpacity
              style={s.contextBtn}
              onPress={onShowContext}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Ionicons name="book-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          )}

          {item.explanation && isAnswered && (
            <TouchableOpacity
              style={s.explanationBtn}
              onPress={onShowExplanation}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            >
              <Ionicons name="help-circle-outline" size={16} color={theme.colors.info} />
            </TouchableOpacity>
          )}

        </View>{/* /flipWrapper */}

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
            <Text style={{ fontSize: 12, color: theme.colors.text.placeholder }}>{t('flashcards.tapToContinue')}</Text>
          </TouchableOpacity>
        )}

      </View>
    </ScrollView>
  );
};
