/**
 * MultipleChoiceView.tsx
 *
 * Vista de pregunta de selección múltiple estilo ECAES/SABER PRO.
 * Muestra un enunciado y una cuadrícula 2×2 de opciones (A, B, C, D).
 * Al seleccionar una opción:
 *  - Se resalta en verde si es correcta, rojo si es incorrecta.
 *  - La opción correcta siempre se revela en verde.
 *  - Se muestra la explicación de por qué la respuesta es correcta.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated, TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { EvaluationItem, MultipleChoiceContent } from '../../services/api/types';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

interface Props {
  item: EvaluationItem;
  onAnswer: (selectedIndex: number) => void;
  onShowExplanation: () => void;
  isAnswered: boolean;
  selectedIndex: number | null;
  onNext?: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/** Fisher-Yates shuffle (mutates array, returns it) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const MultipleChoiceView: React.FC<Props> = ({
  item, onAnswer, onShowExplanation, isAnswered, selectedIndex, onNext
}) => {
  const content = item.content as MultipleChoiceContent;
  const [hintVisible, setHintVisible] = useState(false);
  const hintAnim = useRef(new Animated.Value(0)).current;
  const isNavigating = useRef(false);

  // Shuffle order: shuffledPos → originalIndex (resets per question)
  const shuffledIndices = useRef<number[]>([]);
  if (shuffledIndices.current.length === 0) {
    shuffledIndices.current = shuffle([...Array(content.options.length).keys()]);
  }

  useEffect(() => {
    setHintVisible(false);
    hintAnim.setValue(0);
    shuffledIndices.current = shuffle([...Array(content.options.length).keys()]);
  }, [item.id, hintAnim]);

  const toggleHint = () => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };

  const correctIdx = Number(content.correctIndex);

  const getOptionStyle = (shuffledPos: number, originalIdx: number) => {
    if (!isAnswered) return [s.option];
    if (originalIdx === correctIdx) return [s.option, s.optionCorrect];
    if (originalIdx === selectedIndex) return [s.option, s.optionWrong];
    return [s.option, s.optionDimmed];
  };

  const getOptionTextStyle = (originalIdx: number) => {
    if (!isAnswered) return s.optionText;
    if (originalIdx === correctIdx) return [s.optionText, { color: '#2E7D32' }];
    if (originalIdx === selectedIndex) return [s.optionText, { color: '#C62828' }];
    return [s.optionText, { color: theme.colors.text.placeholder }];
  };

  const getLabelStyle = (originalIdx: number) => {
    if (!isAnswered) return [s.optionLabel];
    if (originalIdx === correctIdx) return [s.optionLabel, s.optionLabelCorrect];
    if (originalIdx === selectedIndex) return [s.optionLabel, s.optionLabelWrong];
    return [s.optionLabel, s.optionLabelDimmed];
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}>
      <TouchableWithoutFeedback 
        onPress={() => { 
          if (isAnswered && onNext && !isNavigating.current) { 
            isNavigating.current = true; 
            onNext(); 
            setTimeout(() => isNavigating.current = false, 400); 
          } 
        }}
      >
        <View style={{ flexGrow: 1 }}>
      {/* Hint banner — solo cuando el usuario lo pide */}
      {item.hint && hintVisible && !isAnswered && (
        <Animated.View style={[s.hintBadge, { opacity: hintAnim, transform: [{ translateY: hintAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
          <Ionicons name="bulb" size={13} color="#FF9500" />
          <Text style={s.hintText}>{item.hint}</Text>
        </Animated.View>
      )}

      {/* Question + hint toggle button */}
      <View style={s.questionCard}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1, width: '100%' }}>
            <Text style={s.questionLabel}>Pregunta</Text>
            <View style={s.questionTextWrapper}>
              <MarkdownWithCode>{content.question}</MarkdownWithCode>
            </View>
          </View>
          <View style={{ gap: 8, flexShrink: 0, marginTop: 4 }}>
            {item.hint && !isAnswered && (
              <TouchableOpacity style={[s.hintBtn, hintVisible && s.hintBtnActive]} onPress={toggleHint} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={hintVisible ? 'bulb' : 'bulb-outline'} size={15} color={hintVisible ? '#FF9500' : '#999'} />
              </TouchableOpacity>
            )}
            {item.explanation && isAnswered && (
              <TouchableOpacity style={s.explanationBtn} onPress={onShowExplanation} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="help-circle-outline" size={15} color={theme.colors.info} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Options grid 2x2 — rendered in shuffled order */}
      <View style={s.optionsGrid}>
        {shuffledIndices.current.map((originalIdx, shuffledPos) => (
          <TouchableOpacity
            key={originalIdx}
            style={getOptionStyle(shuffledPos, originalIdx)}
            onPress={() => !isAnswered && onAnswer(originalIdx)}
            disabled={isAnswered}
            activeOpacity={0.75}
          >
            <View style={getLabelStyle(originalIdx)}>
              <Text style={s.optionLabelText}>{OPTION_LABELS[shuffledPos]}</Text>
            </View>
            <Text style={getOptionTextStyle(originalIdx)}>{content.options[originalIdx]}</Text>
            
            {isAnswered && originalIdx === correctIdx && (
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" style={s.resultIcon} />
            )}
            {isAnswered && originalIdx === selectedIndex && originalIdx !== correctIdx && (
              <Ionicons name="close-circle" size={20} color="#C62828" style={s.resultIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>

        <View style={{ height: 16 }} />
        {isAnswered && onNext && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 }}
            activeOpacity={0.6}
            onPress={() => { if (!isNavigating.current) { isNavigating.current = true; onNext(); setTimeout(() => isNavigating.current = false, 400); } }}
          >
            <Ionicons name="chevron-forward-outline" size={14} color={theme.colors.text.placeholder} />
            <Text style={{ fontSize: 12, color: theme.colors.text.placeholder }}>Toca para continuar</Text>
          </TouchableOpacity>
        )}
        </View>
      </TouchableWithoutFeedback>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  hintBadge: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,149,0,0.09)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)',
  },
  hintText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 17 },
  hintBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: '#E0E0E0', marginLeft: 8, flexShrink: 0 },
  hintBtnActive: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: '#FF9500' },
  explanationBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,122,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,122,255,0.3)', flexShrink: 0 },
  questionCard: {
    backgroundColor: theme.colors.background, borderRadius: 20, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  questionLabel: {
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, color: theme.colors.text.placeholder, marginBottom: 8,
  },
  questionTextWrapper: {
    flex: 1, width: '100%', justifyContent: 'flex-start',
  },
  questionText: {
    fontSize: 16, fontWeight: '600', color: theme.colors.text.primary, lineHeight: 23,
  },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  option: {
    width: '47.5%', backgroundColor: theme.colors.inputBackground,
    borderRadius: 16, padding: 14, paddingRight: 28, borderWidth: 2,
    borderColor: theme.colors.border, flexDirection: 'row',
    alignItems: 'center', gap: 10, minHeight: 74,
  },
  optionCorrect: {
    backgroundColor: '#E8F5E9', borderColor: '#4CAF50',
  },
  optionWrong: {
    backgroundColor: '#FFEBEE', borderColor: '#EF5350',
  },
  optionDimmed: { opacity: 0.45 },
  optionLabel: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optionLabelCorrect: { backgroundColor: '#4CAF50' },
  optionLabelWrong: { backgroundColor: '#EF5350' },
  optionLabelDimmed: { backgroundColor: theme.colors.border, opacity: 0.5 },
  optionLabelText: { fontSize: 12, fontWeight: '800', color: theme.colors.text.primary },
  optionText: {
    flex: 1, fontSize: 13, fontWeight: '500',
    color: theme.colors.text.primary, lineHeight: 18,
  },
  resultIcon: { position: 'absolute' as any, top: 10, right: 10 },
  explanationBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(0,122,255,0.07)', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(0,122,255,0.18)',
  },
  explanationTitle: {
    fontSize: 11, fontWeight: '700', color: theme.colors.info,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  explanationText: { fontSize: 13, color: theme.colors.text.primary, lineHeight: 19 },
});
