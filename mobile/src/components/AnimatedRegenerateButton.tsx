import React, { useRef } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface Props {
  count: number;
  onRegenerate: () => void;
}

/**
 * AnimatedRegenerateButton.tsx
 *
 * Componente que renderiza un botón con animación de "presión mantenida" (long press progress).
 * Al mantener presionado el botón, una barra de progreso se llena visualmente;
 * si se completa el tiempo (1.5s), se dispara la función `onRegenerate`.
 * Útil para acciones destructivas o costosas (como regenerar texto con IA)
 * para evitar toques accidentales.
 *
 * @param count - Número de regeneraciones restantes disponibles (si es <= 0, se deshabilita).
 * @param onRegenerate - Función callback ejecutada al completarse la animación de presión.
 */
export const AnimatedRegenerateButton: React.FC<Props> = ({ count, onRegenerate }) => {
  const fillAnim = useRef(new Animated.Value(0)).current;
  
  const handlePressIn = () => {
    if (count <= 0) return;
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: 1500, // 1.5 segundos para llenarse y activar
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onRegenerate();
        Animated.timing(fillAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      }
    });
  };

  const handlePressOut = () => {
    if (count <= 0) return;
    Animated.timing(fillAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const widthInterpolation = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  const isDisabled = count <= 0;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isDisabled ? theme.colors.border : theme.colors.primary,
        backgroundColor: isDisabled ? theme.colors.background : 'transparent',
        overflow: 'hidden',
        opacity: isDisabled ? 0.6 : 1
      }}
    >
      <Animated.View style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: widthInterpolation,
        backgroundColor: `${theme.colors.primary}40`,
      }} />
      <Ionicons name="refresh-outline" size={16} color={isDisabled ? theme.colors.text.placeholder : theme.colors.primary} />
      <Text style={{ 
        marginLeft: 6, 
        fontSize: 13, 
        fontWeight: '600', 
        color: isDisabled ? theme.colors.text.placeholder : theme.colors.primary 
      }}>
        Regenerar (x{count})
      </Text>
    </Pressable>
  );
};
