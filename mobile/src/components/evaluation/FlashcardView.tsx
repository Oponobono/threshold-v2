import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { EvaluationItem, FlashcardContent } from '../../services/api/types';

interface Props {
  item: EvaluationItem;
  onReveal: () => void;
  onAnswer: (rating: 'learning' | 'review') => void;
  isAnswered: boolean;
  selectedRating: 'learning' | 'review' | null;
}

export const FlashcardView: React.FC<Props> = ({
  item, onReveal, onAnswer, isAnswered, selectedRating,
}) => {
  const content = item.content as FlashcardContent;
  const [isFlipped, setIsFlipped] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setIsFlipped(false);
    setHintVisible(false);
    flipAnim.setValue(0);
    hintAnim.setValue(0);
  }, [item.id, flipAnim, hintAnim]);

  const handleFlip = () => {
    if (isFlipped) return;
    Animated.spring(flipAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start(() => {
      setIsFlipped(true);
      onReveal();
    });
  };

  const toggleHint = () => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, {
      toValue: next ? 1 : 0, duration: 220, useNativeDriver: true,
    }).start();
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [1, 1, 0, 0] });
  const backOpacity  = flipAnim.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] });
  const cardScale = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1] });

  return (
    <View>
      {/* Hint banner — solo visible cuando el usuario lo pide */}
      {item.hint && hintVisible && (
        <Animated.View style={[s.hintBanner, { opacity: hintAnim, transform: [{ translateY: hintAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
          <Ionicons name="bulb" size={14} color="#FF9500" />
          <Text style={s.hintText}>{item.hint}</Text>
        </Animated.View>
      )}

      {/* Flip card */}
      <TouchableOpacity activeOpacity={0.95} onPress={handleFlip} style={s.flipWrapper} disabled={isFlipped}>
        <Animated.View style={[s.card, s.cardFront, { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotate }, { scale: cardScale }] }]}>
          <Text style={s.sideLabel}>Pregunta</Text>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={s.cardText}>{content.front}</Text>
          </ScrollView>
          {/* Botón pista (bombillo) — solo si hay hint */}
          {item.hint && (
            <TouchableOpacity style={[s.hintBtn, hintVisible && s.hintBtnActive]} onPress={toggleHint} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={hintVisible ? 'bulb' : 'bulb-outline'} size={16} color={hintVisible ? '#FF9500' : theme.colors.text.placeholder} />
            </TouchableOpacity>
          )}
          <View style={s.tapHint}>
            <Ionicons name="sync-outline" size={13} color={theme.colors.text.placeholder} />
            <Text style={s.tapHintText}>Toca para revelar</Text>
          </View>
        </Animated.View>

        <Animated.View style={[s.card, s.cardBack, { opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotate }, { scale: cardScale }] }]}>
          <Text style={s.sideLabel}>Respuesta</Text>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={s.cardText}>{content.back}</Text>
          </ScrollView>

        </Animated.View>
      </TouchableOpacity>

      {/* Rating buttons — solo tras flip */}
      {isFlipped && (
        <View style={s.ratingRow}>
          <TouchableOpacity style={[s.ratingBtn, s.ratingHard, selectedRating && selectedRating !== 'learning' && { opacity: 0.3 }]} onPress={() => onAnswer('learning')} disabled={isAnswered}>
            <Text style={s.ratingEmoji}>😓</Text>
            <Text style={[s.ratingLabel, { color: '#FF9800' }]}>Difícil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.ratingBtn, s.ratingEasy, selectedRating && selectedRating !== 'review' && { opacity: 0.3 }]} onPress={() => onAnswer('review')} disabled={isAnswered}>
            <Text style={s.ratingEmoji}>😊</Text>
            <Text style={[s.ratingLabel, { color: '#4CAF50' }]}>Fácil</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  hintBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,149,0,0.10)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)',
  },
  hintText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 17 },
  flipWrapper: { height: 220, marginBottom: 16 },
  card: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 24, padding: 20, justifyContent: 'center', alignItems: 'center',
    backfaceVisibility: 'hidden', borderWidth: 1, borderColor: theme.colors.border,
  } as any,
  cardFront: { backgroundColor: theme.colors.background, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cardBack: { backgroundColor: theme.colors.primary + '08' },
  sideLabel: { position: 'absolute', top: 12, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.text.placeholder },
  cardText: { fontSize: 18, fontWeight: '600', color: theme.colors.text.primary, textAlign: 'center', lineHeight: 26 },
  hintBtn: { position: 'absolute', bottom: 36, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.inputBackground, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  hintBtnActive: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: '#FF9500' },
  tapHint: { position: 'absolute', bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tapHintText: { fontSize: 11, color: theme.colors.text.placeholder },
  explanationBox: { position: 'absolute', bottom: 12, left: 14, right: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(0,122,255,0.07)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  explanationText: { flex: 1, fontSize: 11, color: theme.colors.info, lineHeight: 15 },
  ratingRow: { flexDirection: 'row', gap: 12 },
  ratingBtn: { flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  ratingHard: { backgroundColor: '#FFF3E0', borderColor: '#FFCC80' },
  ratingEasy: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  ratingEmoji: { fontSize: 22 },
  ratingLabel: { fontSize: 13, fontWeight: '700' },
});
