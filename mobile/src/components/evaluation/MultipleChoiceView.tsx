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
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Animated, TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { s } from '../../styles/MultipleChoiceView.styles';
import { EvaluationItem, MultipleChoiceContent } from '../../services/api/types';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

interface Props {
  item: EvaluationItem;
  onAnswer: (selectedIndex: number) => void;
  onShowExplanation: () => void;
  onShowContext: () => void;
  isAnswered: boolean;
  selectedIndex: number | null;
  onNext?: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const MultipleChoiceView: React.FC<Props> = ({
  item, onAnswer, onShowExplanation, onShowContext, isAnswered, selectedIndex, onNext
}) => {
  const content = item.content as MultipleChoiceContent;
  const [hintVisible, setHintVisible] = useState(false);
  const hintAnim = useRef(new Animated.Value(0)).current;
  const isNavigating = useRef(false);

  // Shuffle order once per question — estable mientras item.id no cambie
  const shuffledIndices = useMemo(
    () => shuffle([...Array(content.options.length).keys()]),
    [item.id]
  );

  useEffect(() => {
    setHintVisible(false);
    hintAnim.setValue(0);
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
            
            {item.source_context && (
              <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
                <TouchableOpacity style={s.contextBtn} onPress={onShowContext} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="book-outline" size={15} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            )}
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
        {shuffledIndices.map((originalIdx, shuffledPos) => (
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
