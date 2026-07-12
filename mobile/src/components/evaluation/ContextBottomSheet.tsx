import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { s } from '../../styles/ContextBottomSheet.styles';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

interface Props {
  visible: boolean;
  contextJson: string | null;
  onDismiss: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ContextBottomSheet: React.FC<Props> = ({ visible, contextJson, onDismiss }) => {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 4,
          speed: 14,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  // Removido: if (!visible && translateY.getValue() === SCREEN_HEIGHT) return null;
  // Mantenemos el componente montado para que la animación de salida funcione correctamente.
  // Su estilo translateY lo mueve fuera de la pantalla y pointerEvents='none' evita interacciones.
  let parsedContext: any = null;
  if (contextJson) {
    try {
      parsedContext = JSON.parse(contextJson);
    } catch {
      // Fallback si no es JSON válido
      parsedContext = { text: contextJson };
    }
  }

  const textToRender = parsedContext?.text || '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: backdropOpacity }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onDismiss} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={s.handleContainer}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="book-outline" size={22} color={theme.colors.primary} />
            <Text style={s.title}>Contexto Original</Text>
          </View>
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
            <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {textToRender ? (
            <MarkdownWithCode>{textToRender}</MarkdownWithCode>
          ) : (
            <Text style={s.emptyText}>No hay contexto disponible para esta tarjeta.</Text>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};
