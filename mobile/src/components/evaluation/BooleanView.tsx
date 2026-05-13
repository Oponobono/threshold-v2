import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { EvaluationItem, BooleanContent } from '../../services/api/types';

interface Props {
  item: EvaluationItem;
  onAnswer: (answer: boolean) => void;
  isAnswered: boolean;
  selectedAnswer: boolean | null;
}

export const BooleanView: React.FC<Props> = ({ item, onAnswer, isAnswered, selectedAnswer }) => {
  const content = item.content as BooleanContent;
  const [hintVisible, setHintVisible] = useState(false);
  const hintAnim = useRef(new Animated.Value(0)).current;
  const trueScale = useRef(new Animated.Value(1)).current;
  const falseScale = useRef(new Animated.Value(1)).current;

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



  const getBtnStyle = (value: boolean) => {
    const base = [s.boolBtn, value ? s.boolBtnTrue : s.boolBtnFalse];
    if (!isAnswered) return base;
    if (value === content.correctAnswer) return [...base, s.boolBtnSuccess];
    if (value === selectedAnswer) return [...base, s.boolBtnError];
    return [...base, { opacity: 0.35 }];
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
      {/* Hint banner — solo cuando el usuario lo pide */}
      {item.hint && hintVisible && !isAnswered && (
        <Animated.View style={[s.hintBadge, { opacity: hintAnim, transform: [{ translateY: hintAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]}>
          <Ionicons name="bulb" size={13} color="#FF9500" />
          <Text style={s.hintText}>{item.hint}</Text>
        </Animated.View>
      )}
      <View style={s.questionCard}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.questionLabel}>¿Verdadero o Falso?</Text>
            <Text style={s.questionText}>{content.question}</Text>
          </View>
          {item.hint && !isAnswered && (
            <TouchableOpacity style={[s.hintBtn, hintVisible && s.hintBtnActive]} onPress={toggleHint} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={hintVisible ? 'bulb' : 'bulb-outline'} size={15} color={hintVisible ? '#FF9500' : '#999'} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={s.btnRow}>
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: trueScale }] }]}>
          <TouchableOpacity style={getBtnStyle(true)} onPress={() => handleAnswer(true)} disabled={isAnswered} activeOpacity={0.8}>
            <Text style={s.boolIcon}>✅</Text>
            <Text style={s.boolLabel}>Verdadero</Text>
            {isAnswered && content.correctAnswer === true && <Ionicons name="checkmark-circle" size={20} color="#2E7D32" style={s.resultIcon} />}
            {isAnswered && selectedAnswer === true && content.correctAnswer !== true && <Ionicons name="close-circle" size={20} color="#C62828" style={s.resultIcon} />}
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={[{ flex: 1 }, { transform: [{ scale: falseScale }] }]}>
          <TouchableOpacity style={getBtnStyle(false)} onPress={() => handleAnswer(false)} disabled={isAnswered} activeOpacity={0.8}>
            <Text style={s.boolIcon}>❌</Text>
            <Text style={s.boolLabel}>Falso</Text>
            {isAnswered && content.correctAnswer === false && <Ionicons name="checkmark-circle" size={20} color="#2E7D32" style={s.resultIcon} />}
            {isAnswered && selectedAnswer === false && content.correctAnswer !== false && <Ionicons name="close-circle" size={20} color="#C62828" style={s.resultIcon} />}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
};

const s = StyleSheet.create({
  hintBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,149,0,0.09)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)' },
  hintText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 17 },
  hintBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: '#E0E0E0', marginLeft: 8, flexShrink: 0 },
  hintBtnActive: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: '#FF9500' },
  questionCard: { backgroundColor: theme.colors.background, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  questionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.text.placeholder, marginBottom: 10 },
  questionText: { fontSize: 17, fontWeight: '600', color: theme.colors.text.primary, lineHeight: 25 },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  boolBtn: { flex: 1, borderRadius: 20, paddingVertical: 22, alignItems: 'center', borderWidth: 2, gap: 8, justifyContent: 'center' },
  boolBtnTrue: { backgroundColor: '#E8F5E9', borderColor: '#81C784' },
  boolBtnFalse: { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' },
  boolBtnSuccess: { borderWidth: 2.5, borderColor: '#4CAF50' },
  boolBtnError: { borderWidth: 2.5, borderColor: '#EF5350' },
  boolIcon: { fontSize: 32 },
  boolLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.text.primary },
  resultIcon: { position: 'absolute' as any, top: 10, right: 10 },
  explanationBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(0,122,255,0.07)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(0,122,255,0.18)' },
  explanationTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.info, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  explanationText: { fontSize: 13, color: theme.colors.text.primary, lineHeight: 19 },
});
