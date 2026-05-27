import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { EvaluationItem, FlashcardContent } from '../../services/api/types';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

interface Props {
  item: EvaluationItem;
  onReveal: () => void;
  onAnswer: (rating: 'learning' | 'review') => void;
  onShowExplanation: () => void;
  isAnswered: boolean;
  selectedRating: 'learning' | 'review' | null;
  onNext?: () => void;
}

export const FlashcardView: React.FC<Props> = ({
  item, onReveal, onAnswer, onShowExplanation, isAnswered, selectedRating, onNext
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
            <Text style={s.sideLabel}>Pregunta</Text>
            <View style={s.cardContentWrapper}>
              <MarkdownWithCode>{content.front}</MarkdownWithCode>
            </View>
            <View style={s.tapHint}>
              <Ionicons name="sync-outline" size={13} color={theme.colors.text.placeholder} />
              <Text style={s.tapHintText}>Toca para revelar</Text>
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
            <Text style={s.sideLabel}>Respuesta</Text>
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
            <Text style={{ fontSize: 12, color: theme.colors.text.placeholder }}>Toca para continuar</Text>
          </TouchableOpacity>
        )}

      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, marginTop: 8 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingBottom: 32 },
  hintBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,149,0,0.10)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)',
  },
  hintText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 17 },
  flipWrapper: { width: '100%', marginBottom: 16 },
  relativeCard: { position: 'relative' },
  absoluteCard: { position: 'absolute', top: 0, left: 0, right: 0 },
  card: {
    borderRadius: 24, padding: 20, minHeight: 250, justifyContent: 'center',
    backfaceVisibility: 'hidden', borderWidth: 1, borderColor: theme.colors.border,
  } as any,
  cardContentWrapper: { width: '100%', paddingTop: 20, paddingBottom: 24 },
  cardFront: {
    backgroundColor: theme.colors.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardBack: { backgroundColor: theme.colors.primary + '08' },
  sideLabel: {
    position: 'absolute', top: 12, left: 20,
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, color: theme.colors.text.placeholder,
  },
  hintBtn: {
    position: 'absolute', bottom: 36, right: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  hintBtnActive: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: '#FF9500' },
  explanationBtn: {
    position: 'absolute', bottom: 36, right: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,122,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,122,255,0.3)',
  },
  tapHint: {
    position: 'absolute', bottom: 12, left: 20,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  tapHintText: { fontSize: 11, color: theme.colors.text.placeholder },
  ratingRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  ratingBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, gap: 4,
  },
  ratingHard: { backgroundColor: '#FFF3E0', borderColor: '#FFCC80' },
  ratingEasy: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  ratingEmoji: { fontSize: 22 },
  ratingLabel: { fontSize: 13, fontWeight: '700' },
});
