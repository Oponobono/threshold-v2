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
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { EvaluationItem, MultipleChoiceContent } from '../../services/api/types';

interface Props {
  item: EvaluationItem;
  onAnswer: (selectedIndex: number) => void;
  isAnswered: boolean;
  selectedIndex: number | null;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export const MultipleChoiceView: React.FC<Props> = ({
  item, onAnswer, isAnswered, selectedIndex,
}) => {
  const content = item.content as MultipleChoiceContent;
  const [hintVisible, setHintVisible] = useState(false);
  const hintAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setHintVisible(false);
    hintAnim.setValue(0);
  }, [item.id, hintAnim]);

  const toggleHint = () => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };



  const getOptionStyle = (index: number) => {
    if (!isAnswered) return [s.option];
    if (index === content.correctIndex) return [s.option, s.optionCorrect];
    if (index === selectedIndex) return [s.option, s.optionWrong];
    return [s.option, s.optionDimmed];
  };

  const getOptionTextStyle = (index: number) => {
    if (!isAnswered) return s.optionText;
    if (index === content.correctIndex) return [s.optionText, { color: '#2E7D32' }];
    if (index === selectedIndex) return [s.optionText, { color: '#C62828' }];
    return [s.optionText, { color: theme.colors.text.placeholder }];
  };

  const getLabelStyle = (index: number) => {
    if (!isAnswered) return [s.optionLabel];
    if (index === content.correctIndex) return [s.optionLabel, s.optionLabelCorrect];
    if (index === selectedIndex) return [s.optionLabel, s.optionLabelWrong];
    return [s.optionLabel, s.optionLabelDimmed];
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
      {/* Hint banner — solo cuando el usuario lo pide */}
      {item.hint && hintVisible && !isAnswered && (
        <Animated.View style={[s.hintBadge, { opacity: hintAnim, transform: [{ translateY: hintAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
          <Ionicons name="bulb" size={13} color="#FF9500" />
          <Text style={s.hintText}>{item.hint}</Text>
        </Animated.View>
      )}

      {/* Question + hint toggle button */}
      <View style={s.questionCard}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.questionLabel}>Pregunta</Text>
            <Text style={s.questionText}>{content.question}</Text>
          </View>
          {item.hint && !isAnswered && (
            <TouchableOpacity style={[s.hintBtn, hintVisible && s.hintBtnActive]} onPress={toggleHint} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={hintVisible ? 'bulb' : 'bulb-outline'} size={15} color={hintVisible ? '#FF9500' : '#999'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Options grid 2x2 */}
      <View style={s.optionsGrid}>
        {content.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={getOptionStyle(index)}
            onPress={() => !isAnswered && onAnswer(index)}
            disabled={isAnswered}
            activeOpacity={0.75}
          >
            <View style={getLabelStyle(index)}>
              <Text style={s.optionLabelText}>{OPTION_LABELS[index]}</Text>
            </View>
            <Text style={getOptionTextStyle(index)}>{option}</Text>
            {isAnswered && index === content.correctIndex && (
              <Ionicons name="checkmark-circle" size={16} color="#2E7D32" style={s.optionIcon} />
            )}
            {isAnswered && index === selectedIndex && index !== content.correctIndex && (
              <Ionicons name="close-circle" size={16} color="#C62828" style={s.optionIcon} />
            )}
            {isAnswered && index !== content.correctIndex && index !== selectedIndex && (
              <Ionicons name="close-circle" size={16} color="#9E9E9E" style={s.optionIcon} />
            )}
          </TouchableOpacity>
        ))}
      </View>



      <View style={{ height: 16 }} />
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
  questionText: {
    fontSize: 16, fontWeight: '600', color: theme.colors.text.primary, lineHeight: 23,
  },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  option: {
    width: '47.5%', backgroundColor: theme.colors.inputBackground,
    borderRadius: 16, padding: 14, borderWidth: 1.5,
    borderColor: theme.colors.border, flexDirection: 'row',
    alignItems: 'center', gap: 10, minHeight: 64,
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
  optionIcon: { marginLeft: 'auto' as any },
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
