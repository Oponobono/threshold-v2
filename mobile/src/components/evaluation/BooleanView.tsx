import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { s } from '../../styles/BooleanView.styles';
import { EvaluationItem, BooleanContent } from '../../services/api/types';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

interface Props {
  item: EvaluationItem;
  onAnswer: (answer: boolean) => void;
  onShowExplanation: () => void;
  onShowContext: () => void;
  isAnswered: boolean;
  selectedAnswer: boolean | null;
  onNext?: () => void;
}

export const BooleanView: React.FC<Props> = ({ item, onAnswer, onShowExplanation, onShowContext, isAnswered, selectedAnswer, onNext }) => {
  const { t } = useTranslation();
  const content = item.content as BooleanContent;
  const [hintVisible, setHintVisible] = useState(false);
  const hintAnim = useRef(new Animated.Value(0)).current;
  const trueScale = useRef(new Animated.Value(1)).current;
  const falseScale = useRef(new Animated.Value(1)).current;
  const isNavigating = useRef(false);

  useEffect(() => {
    setHintVisible(false);
    hintAnim.setValue(0);
    trueScale.setValue(1);
    falseScale.setValue(1);
  }, [item.id, hintAnim, trueScale, falseScale]);

  const toggleHint = () => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, { toValue: next ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  };

  const handleAnswer = (answer: boolean) => {
    if (isAnswered) return;
    const scaleRef = answer ? trueScale : falseScale;
    Animated.sequence([
      Animated.spring(scaleRef, { toValue: 0.92, friction: 3, useNativeDriver: true }),
      Animated.spring(scaleRef, { toValue: 1.04, friction: 5, useNativeDriver: true }),
      Animated.spring(scaleRef, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
    onAnswer(answer);
  };
  // Normalizamos a string para evitar evasión de tipos 'as any' y tolerar 1/0 o strings de la base de datos
  const normalizedCorrect = String(content.correctAnswer).toLowerCase().trim();
  const isCorrectTrue = normalizedCorrect === 'true' || normalizedCorrect === '1';
  const isCorrectFalse = normalizedCorrect === 'false' || normalizedCorrect === '0';

  const getBtnStyle = (value: boolean) => {
    const base = [s.boolBtn, value ? s.boolBtnTrue : s.boolBtnFalse];
    if (!isAnswered) return base;
    const isThisCorrect = value ? isCorrectTrue : isCorrectFalse;
    if (isThisCorrect) return [...base, s.boolBtnSuccess];
    if (value === selectedAnswer) return [...base, s.boolBtnError];
    return [...base, { opacity: 0.35 }];
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
        <View style={s.questionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1, width: '100%' }}>
              <Text style={s.questionLabel}>{t('evaluation.trueOrFalse')}</Text>
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
        <View style={s.btnRow}>
          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: trueScale }] }]}>
            <TouchableOpacity style={getBtnStyle(true)} onPress={() => handleAnswer(true)} disabled={isAnswered} activeOpacity={0.8}>
              <Text style={s.boolIcon}>✅</Text>
              <Text style={s.boolLabel}>Verdadero</Text>
              {isAnswered && isCorrectTrue && <Ionicons name="checkmark-circle" size={24} color="#2E7D32" style={s.resultIcon} />}
              {isAnswered && selectedAnswer === true && !isCorrectTrue && <Ionicons name="close-circle" size={24} color="#C62828" style={s.resultIcon} />}
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: falseScale }] }]}>
            <TouchableOpacity style={getBtnStyle(false)} onPress={() => handleAnswer(false)} disabled={isAnswered} activeOpacity={0.8}>
              <Text style={s.boolIcon}>❌</Text>
              <Text style={s.boolLabel}>Falso</Text>
              {isAnswered && isCorrectFalse && <Ionicons name="checkmark-circle" size={24} color="#2E7D32" style={s.resultIcon} />}
              {isAnswered && selectedAnswer === false && !isCorrectFalse && <Ionicons name="close-circle" size={24} color="#C62828" style={s.resultIcon} />}
            </TouchableOpacity>
          </Animated.View>
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

