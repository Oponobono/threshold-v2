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

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: 'box-none',
  },
  floatingBox: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 9999,
  },
  scroll: {
    maxHeight: SCREEN_HEIGHT * 0.65,
  },
  explanationBox: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(235, 245, 255, 0.98)', // Fondo azul muy claro casi opaco
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 122, 255, 0.25)',
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.info,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  explanationText: {
    fontSize: 14,
    color: theme.colors.text.primary,
    lineHeight: 21,
    fontWeight: '500',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
    opacity: 0.6,
  },
  tapHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.placeholder,
    textTransform: 'uppercase',
  },
});
