/**
 * ExplanationOverlay.tsx (v2 - Reverted Style)
 *
 * Muestra la explicación en el estilo original (caja azul informativa)
 * pero de forma flotante para no desplazar el contenido.
 * Se cierra al tocarla, permitiendo continuar con el estudio.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { s } from '../../styles/ExplanationOverlay.styles';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  explanation: string | null;
  onDismiss: () => void;
}

export const ExplanationOverlay: React.FC<Props> = ({
  visible, explanation, onDismiss,
}) => {
  const { t } = useTranslation();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible && explanation) {
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      scaleAnim.setValue(0.95);
    }
  }, [visible, explanation, opacityAnim, scaleAnim]);

  if (!visible || !explanation) return null;

  return (
    <View style={s.container} pointerEvents="box-none">
      {/* Backdrop transparente para capturar el tap fuera de la caja también */}
      <TouchableOpacity 
        style={StyleSheet.absoluteFill} 
        activeOpacity={1} 
        onPress={onDismiss} 
      />

      <Animated.View style={[
        s.floatingBox, 
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
      ]}>
        <View style={s.explanationBox}>
          <Ionicons name="information-circle" size={18} color={theme.colors.info} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={s.explanationTitle}>{t('evaluation.why')}</Text>
            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
              <MarkdownWithCode style={{ body: { fontSize: 14, lineHeight: 21, color: theme.colors.text.primary } }}>
                {explanation}
              </MarkdownWithCode>
            </ScrollView>
            <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} style={s.tapHint}>
              <Text style={s.tapHintText}>{t('common.tapToContinue')}</Text>
              <Ionicons name="chevron-forward" size={10} color={theme.colors.text.placeholder} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};
