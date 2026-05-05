import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { flashcardsStyles as s } from '../styles/FlashcardsModal.styles';
import { FlashcardDeck, Flashcard, deleteFlashcard, updateFlashcardStatus, createCardLog } from '../services/api';
import { useCustomAlert } from './CustomAlert';

interface Props {
  activeDeck: FlashcardDeck | null;
  initialCards: Flashcard[];
  currentUserId: number | null;
  onBack: () => void;
}

/**
 * FlashcardStudyScreen.tsx
 *
 * Sub-pantalla de sesión de estudio activa con el sistema de repetición espaciada.
 * Muestra las tarjetas de un mazo de una en una con animación de "volteo" (flip 3D)
 * al presionar. Tras revelar la respuesta, el usuario califica su conocimiento como
 * "difícil" (learning) o "fácil" (review), lo que actualiza el estado de la tarjeta
 * en la BD y registra el tiempo de respuesta en `card_logs` para analytics.
 * Usa animaciones Lottie ("thinking" y "eureka") para enriquecer la retroalimentación visual.
 *
 * @param activeDeck - Mazo activo con metadatos (título, materia, propietario).
 * @param initialCards - Arreglo de tarjetas pre-ordenadas (new → learning → review).
 * @param currentUserId - ID del usuario autenticado (para validar permisos de eliminación).
 * @param onBack - Callback para volver al hub de mazos al finalizar o salir.
 */
export const FlashcardStudyScreen: React.FC<Props> = ({ activeDeck, initialCards, currentUserId, onBack }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();

  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<'learning' | 'review' | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [cardStartTime, setCardStartTime] = useState<number>(Date.now());

  const flipAnim = useRef(new Animated.Value(0)).current;
  const reactionAnim = useRef(new Animated.Value(0)).current;

  // Reset state when cards change
  useEffect(() => {
    setCards(initialCards);
    setCardIndex(0);
    setIsFlipped(false);
    setSessionDone(false);
    setSelectedFeedback(null);
    setAnswerRevealed(false);
    setCardStartTime(Date.now());
    flipAnim.setValue(0);
    reactionAnim.setValue(0);
  }, [initialCards, flipAnim, reactionAnim]);

  const handleFlip = () => {
    const nextFlipped = !isFlipped;
    
    Animated.spring(flipAnim, {
      toValue: nextFlipped ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start(() => setIsFlipped(nextFlipped));

    if (nextFlipped && !answerRevealed) {
      setAnswerRevealed(true);
      Animated.sequence([
        Animated.timing(reactionAnim, { toValue: 1, duration: 200, easing: Easing.ease, useNativeDriver: true }),
        Animated.delay(500),
        Animated.timing(reactionAnim, { toValue: 2, duration: 400, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true })
      ]).start();
    }
  };

  const handleFeedback = async (status: 'learning' | 'review') => {
    if (selectedFeedback) return;
    setSelectedFeedback(status);

    const card = cards[cardIndex];
    const responseTime = Date.now() - cardStartTime;

    try {
      await updateFlashcardStatus(card.id, status);
      await createCardLog({
        card_id: card.id,
        result: status,
        response_time_ms: responseTime,
      });
    } catch (_) {}

    setTimeout(() => {
      const next = cardIndex + 1;
      if (next >= cards.length) {
        setSessionDone(true);
      } else {
        setIsFlipped(false);
        flipAnim.setValue(0);
        reactionAnim.setValue(0);
        setAnswerRevealed(false);
        setCardIndex(next);
        setCardStartTime(Date.now());
      }
      setSelectedFeedback(null);
    }, 1200);
  };

  const handleDeleteCard = (cardId: number) => {
    showAlert({
      title: t('modals.deleteCard', 'Eliminar Tarjeta'),
      message: t('modals.deleteCardConfirm', '¿Estás seguro de que deseas eliminar esta tarjeta?'),
      type: 'confirm',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFlashcard(cardId);
              const updatedCards = cards.filter(c => c.id !== cardId);
              setCards(updatedCards);
              if (updatedCards.length === 0) {
                setSessionDone(true);
              } else if (cardIndex >= updatedCards.length) {
                setCardIndex(updatedCards.length - 1);
              }
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message || 'Error al eliminar la tarjeta', type: 'error' });
            }
          }
        }
      ]
    });
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] });
  const cardScale = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1] });

  if (sessionDone) {
    return (
      <View style={s.sessionDone}>
        <Text style={s.sessionDoneEmoji}>🌟</Text>
        <Text style={s.sessionDoneTitle}>{t('flashcards.sessionDone')}</Text>
        <Text style={s.sessionDoneSubtitle}>{t('flashcards.sessionDoneMsg', { count: cards.length })}</Text>
        <TouchableOpacity style={s.newDeckBtn} onPress={onBack}>
          <Text style={s.newDeckBtnText}>{t('flashcards.backToDecks')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const card = cards[cardIndex];
  if (!card) return null;

  return (
    <View style={{ paddingBottom: 8 }}>
      <View style={s.studyHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={s.studyDeckTitle} numberOfLines={1}>{activeDeck?.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={s.studyCounter}>{cardIndex + 1}/{cards.length}</Text>
          {activeDeck?.user_id === currentUserId && (
            <TouchableOpacity onPress={() => card.id && handleDeleteCard(card.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={20} color="#D32F2F" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${((cardIndex + 1) / cards.length) * 100}%` as any }]} />
      </View>

      <TouchableOpacity activeOpacity={0.95} onPress={handleFlip} style={s.flipWrapper}>
        <Animated.View style={[
          s.card, s.cardFront,
          { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotate }, { scale: cardScale }] }
        ]}>
          <Text style={s.cardHint}>{t('flashcards.front')}</Text>
          <Text style={s.cardText}>{card.front}</Text>
          <View style={s.tapHint}>
            <Ionicons name="sync-outline" size={16} color={theme.colors.text.placeholder} />
            <Text style={s.tapHintText}>{t('flashcards.tapToFlip')}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[
          s.card, s.cardBack,
          { opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotate }, { scale: cardScale }] }
        ]}>
          <Text style={s.cardHint}>{t('flashcards.back')}</Text>
          <Text style={s.cardText}>{card.back}</Text>
        </Animated.View>
      </TouchableOpacity>

      <View style={s.feedbackArea}>
        <Animated.View style={[s.reactionAbsolute, { 
          opacity: reactionAnim.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0] }) 
        }]}>
          <LottieView 
            source={require('../lottieFiles/thinking.json')}
            autoPlay
            loop
            style={{ width: 80, height: 80 }}
          />
        </Animated.View>

        <Animated.View style={[s.reactionAbsolute, { 
          opacity: reactionAnim.interpolate({ inputRange: [0.4, 1, 1.5], outputRange: [0, 1, 0] }),
          transform: [{ scale: reactionAnim.interpolate({ inputRange: [0.4, 1], outputRange: [0.5, 1.2], extrapolate: 'clamp' }) }]
        }]}>
          <LottieView 
            key={`eureka-${cardIndex}`}
            source={require('../lottieFiles/eureka.json')}
            autoPlay
            loop={false}
            style={{ width: 80, height: 80 }}
          />
        </Animated.View>

        <Animated.View style={[s.reactionAbsolute, s.feedbackRow, { 
          opacity: reactionAnim.interpolate({ inputRange: [1.5, 2], outputRange: [0, 1] }),
          transform: [{ scale: reactionAnim.interpolate({ inputRange: [1.5, 2], outputRange: [0.9, 1], extrapolate: 'clamp' }) }]
        }]}>
          <TouchableOpacity 
            style={[
              s.feedbackBtn, 
              s.feedbackBtnHard, 
              selectedFeedback && selectedFeedback !== 'learning' && { opacity: 0.3 }
            ]} 
            onPress={() => handleFeedback('learning')}
            disabled={!!selectedFeedback}
          >
            <MaterialCommunityIcons name="brain" size={26} color="#FF9800" style={{ marginBottom: 6 }} />
            <Text style={[s.feedbackBtnTextDark, { color: '#FF9800', fontWeight: '700', fontSize: 13 }]}>{t('flashcards.hard')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              s.feedbackBtn, 
              s.feedbackBtnEasy, 
              selectedFeedback && selectedFeedback !== 'review' && { opacity: 0.3 }
            ]} 
            onPress={() => handleFeedback('review')}
            disabled={!!selectedFeedback}
          >
            <MaterialCommunityIcons name="check-decagram" size={26} color="#4CAF50" style={{ marginBottom: 6 }} />
            <Text style={[s.feedbackBtnTextDark, { color: '#4CAF50', fontWeight: '700', fontSize: 13 }]}>{t('flashcards.easy')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};
